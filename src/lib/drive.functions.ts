import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIPOS = [
  "contrato",
  "rg",
  "cpf",
  "comprovante_renda",
  "fiador",
  "foto_imovel",
  "outro",
] as const;

async function assertAdmin(supabase: ReturnType<typeof Object> | any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  const { data: isAdministrativo } = await supabase.rpc("is_administrativo", {
    _user_id: userId,
  });
  if (!isAdmin && !isAdministrativo) {
    throw new Error("Forbidden: somente admin ou administrativo");
  }
}

/** List documents for a given imovel or contrato. */
export const listDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imovelId?: string; contratoId?: string }) =>
    z
      .object({
        imovelId: z.string().uuid().optional(),
        contratoId: z.string().uuid().optional(),
      })
      .refine((v) => v.imovelId || v.contratoId, "imovelId or contratoId required")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("documentos" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (data.contratoId) q = q.eq("contrato_id", data.contratoId);
    else if (data.imovelId) q = q.eq("imovel_id", data.imovelId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { documentos: (rows ?? []) as Array<Record<string, unknown>> };
  });

/** Upload a document to Drive and persist a row in `documentos`. */
export const uploadDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      imovelId?: string;
      contratoId?: string;
      tipo: (typeof TIPOS)[number];
      nome: string;
      mimeType: string;
      base64: string;
    }) =>
      z
        .object({
          imovelId: z.string().uuid().optional(),
          contratoId: z.string().uuid().optional(),
          tipo: z.enum(TIPOS),
          nome: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(150),
          base64: z.string().min(1),
        })
        .refine((v) => v.imovelId || v.contratoId, "imovelId or contratoId required")
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { ensureImovelFolder, ensureContratoFolder, uploadFileToDrive } = await import(
      "@/lib/drive.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load imovel (and contrato) to build folder path.
    let imovelId = data.imovelId;
    let contrato: { id: string; locatario_nome: string; imovel_id: string; drive_folder_id: string | null } | null =
      null;

    if (data.contratoId) {
      const { data: c, error } = await supabaseAdmin
        .from("contratos" as never)
        .select("id, locatario_nome, imovel_id, drive_folder_id")
        .eq("id", data.contratoId)
        .maybeSingle();
      if (error || !c) throw new Error("Contrato não encontrado");
      contrato = c as never;
      imovelId = contrato!.imovel_id;
    }

    const { data: imovel, error: imErr } = await supabaseAdmin
      .from("imoveis" as never)
      .select("id, rua, numero, bairro, cidade, drive_folder_id")
      .eq("id", imovelId!)
      .maybeSingle();
    if (imErr || !imovel) throw new Error("Imóvel não encontrado");
    const im = imovel as {
      id: string;
      rua: string | null;
      numero: string | null;
      bairro: string | null;
      cidade: string | null;
      drive_folder_id: string | null;
    };
    const endereco = [im.rua, im.numero, im.bairro, im.cidade].filter(Boolean).join(", ").trim();

    // Resolve target folder.
    let folderId: string;
    let accessToken: string;
    if (contrato) {
      const r = await ensureContratoFolder(context.userId, endereco, contrato.locatario_nome);
      folderId = r.folderId;
      accessToken = r.accessToken;
      if (contrato.drive_folder_id !== folderId) {
        await supabaseAdmin
          .from("contratos" as never)
          .update({ drive_folder_id: folderId } as never)
          .eq("id", contrato.id);
      }
    } else {
      const r = await ensureImovelFolder(context.userId, endereco);
      folderId = r.folderId;
      accessToken = r.accessToken;
    }
    if (im.drive_folder_id !== folderId && !contrato) {
      await supabaseAdmin
        .from("imoveis" as never)
        .update({ drive_folder_id: folderId } as never)
        .eq("id", im.id);
    }

    // Decode base64 → bytes.
    const bytes = Uint8Array.from(Buffer.from(data.base64, "base64"));

    const uploaded = await uploadFileToDrive(accessToken, folderId, {
      name: data.nome,
      mimeType: data.mimeType,
      bytes,
    });

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("documentos" as never)
      .insert({
        imovel_id: contrato ? null : im.id,
        contrato_id: contrato ? contrato.id : null,
        tipo: data.tipo,
        nome: uploaded.name,
        mime_type: uploaded.mimeType,
        tamanho_bytes: uploaded.size,
        drive_file_id: uploaded.id,
        drive_web_view_link: uploaded.webViewLink,
        drive_web_content_link: uploaded.webContentLink,
        uploaded_by: context.userId,
      } as never)
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { documento: inserted };
  });

/** Delete a document from Drive and the `documentos` table. */
export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { deleteDriveFile } = await import("@/lib/drive.server");
    const { getValidAccessToken } = await import("@/lib/google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("documentos" as never)
      .select("id, drive_file_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Documento não encontrado");
    const r = row as { id: string; drive_file_id: string };

    const token = await getValidAccessToken(context.userId);
    if (token) {
      try {
        await deleteDriveFile(token, r.drive_file_id);
      } catch (e) {
        console.warn("[drive] delete failed (continuando):", e);
      }
    }
    await supabaseAdmin.from("documentos" as never).delete().eq("id", r.id);
    return { ok: true };
  });
