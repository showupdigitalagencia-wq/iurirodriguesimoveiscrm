import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BackupItem = {
  nome: string;
  data: string; // YYYY-MM-DD extraído do nome
  tamanho_bytes: number;
  criado_em: string | null;
};

async function ensureAdmin(context: { supabase: ReturnType<typeof Object>; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = context.supabase as any;
  const { data: isAdmin } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listarBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.storage
      .from("backups-sistema")
      .list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    if (error) throw new Error(error.message);

    const items: BackupItem[] = [];
    for (const obj of data ?? []) {
      const m = obj.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.zip$/);
      if (!m) continue;
      const meta = obj.metadata as { size?: number } | null;
      items.push({
        nome: obj.name,
        data: m[1],
        tamanho_bytes: meta?.size ?? 0,
        criado_em: obj.created_at ?? null,
      });
    }
    items.sort((a, b) => (a.data < b.data ? 1 : -1));
    return items;
  });

export const gerarUrlBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string }) => {
    if (!input?.nome || !/^backup-\d{4}-\d{2}-\d{2}\.zip$/.test(input.nome)) {
      throw new Error("Nome de arquivo inválido");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("backups-sistema")
      .createSignedUrl(data.nome, 300); // 5 minutos
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL");

    try {
      await supabaseAdmin.rpc("log_audit", {
        _acao: "backup_download_url",
        _contexto: { arquivo: data.nome } as never,
      });
    } catch {
      // ignora
    }
    return { url: signed.signedUrl, expires_in: 300 };
  });

export const rodarBackupManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { buildExportZipBuffer } = await import("@/lib/export-sistema.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const built = await buildExportZipBuffer(context.userId);
    const today = new Date().toISOString().slice(0, 10);
    const objectPath = `backup-${today}.zip`;
    const { error } = await supabaseAdmin.storage
      .from("backups-sistema")
      .upload(objectPath, built.bytes, {
        contentType: "application/zip",
        upsert: true,
      });
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.rpc("log_audit", {
        _acao: "backup_manual",
        _contexto: {
          arquivo: objectPath,
          tamanho_bytes: built.bytes.length,
          tabelas: built.resumo,
        } as never,
      });
    } catch {
      // ignora
    }

    return { arquivo: objectPath, tamanho_bytes: built.bytes.length };
  });
