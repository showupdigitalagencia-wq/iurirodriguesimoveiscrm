import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CaptacaoTeamPhoto = {
  path: string;
  nome: string;
  cargo: string;
};

export const CAPTACAO_EXEC_REFS = ["barra", "recreio", "belford", "mesquita"] as const;
export type CaptacaoExecRef = (typeof CAPTACAO_EXEC_REFS)[number];

async function signed(supabaseAdmin: { storage: { from: (b: string) => { createSignedUrl: (p: string, t: number) => Promise<{ data: { signedUrl: string } | null }> } } }, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from("captacao-assets").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

// ============================================================
// PÚBLICO: configuração da LP /seja-corretor (VSL + fotos com signed URL)
// ============================================================
export const getCaptacaoConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [
      "vsl_captacao_url",
      "captacao_team_photos",
      "captacao_group_photo",
      "captacao_executivo_photos",
    ]);

  let vslUrl = "";
  let photos: CaptacaoTeamPhoto[] = [];
  let groupPath: string | null = null;
  let execPaths: Partial<Record<CaptacaoExecRef, string>> = {};
  for (const row of data ?? []) {
    if (row.chave === "vsl_captacao_url") {
      const v = row.valor as string | { url?: string } | null;
      vslUrl = typeof v === "string" ? v : v?.url ?? "";
    } else if (row.chave === "captacao_team_photos") {
      const v = row.valor as CaptacaoTeamPhoto[] | null;
      if (Array.isArray(v)) photos = v.slice(0, 4);
    } else if (row.chave === "captacao_group_photo") {
      const v = row.valor as { path?: string } | string | null;
      groupPath = typeof v === "string" ? v : v?.path ?? null;
    } else if (row.chave === "captacao_executivo_photos") {
      const v = row.valor as Record<string, { path?: string } | string> | null;
      if (v && typeof v === "object") {
        for (const ref of CAPTACAO_EXEC_REFS) {
          const e = v[ref];
          const p = typeof e === "string" ? e : e?.path;
          if (p) execPaths[ref] = p;
        }
      }
    }
  }

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => ({ ...p, url: await signed(supabaseAdmin, p.path) })),
  );
  const groupUrl = await signed(supabaseAdmin, groupPath);
  const execEntries = await Promise.all(
    CAPTACAO_EXEC_REFS.map(async (ref) => [ref, await signed(supabaseAdmin, execPaths[ref] ?? null)] as const),
  );
  const execPhotos = Object.fromEntries(execEntries) as Record<CaptacaoExecRef, string | null>;

  return { vslUrl, photos: photosWithUrls, groupUrl, execPhotos };
});

// ============================================================
// ADMIN: salvar URL do VSL da captação
// ============================================================
export const setCaptacaoVslUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) =>
    z.object({ url: z.string().trim().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "vsl_captacao_url", valor: data.url as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ADMIN: upload de foto do time (máx 4)
// ============================================================
export const uploadCaptacaoTeamPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { index: number; nome: string; cargo: string; arquivo: { nome: string; mimeType: string; base64: string } }) =>
      z
        .object({
          index: z.number().int().min(0).max(3),
          nome: z.string().trim().max(80),
          cargo: z.string().trim().max(80),
          arquivo: z.object({
            nome: z.string().min(1).max(255),
            mimeType: z.string().min(1).max(150),
            base64: z.string().min(1),
          }),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lê fotos atuais
    const { data: cfg } = await supabaseAdmin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "captacao_team_photos")
      .maybeSingle();
    const current: CaptacaoTeamPhoto[] = Array.isArray((cfg as { valor?: unknown } | null)?.valor)
      ? ((cfg as { valor: CaptacaoTeamPhoto[] }).valor.slice(0, 4))
      : [];

    // Upload novo arquivo
    const bin = Uint8Array.from(atob(data.arquivo.base64), (c) => c.charCodeAt(0));
    const safeName = data.arquivo.nome.replace(/[^\w.\-]/g, "_");
    const path = `team/${data.index}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("captacao-assets")
      .upload(path, bin, { contentType: data.arquivo.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    // Substitui no slot, removendo antigo se existir
    const next = [...current];
    while (next.length <= data.index) next.push({ path: "", nome: "", cargo: "" });
    const oldPath = next[data.index]?.path;
    next[data.index] = { path, nome: data.nome, cargo: data.cargo };

    if (oldPath) {
      await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);
    }

    const { error: saveErr } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_team_photos", valor: next as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (saveErr) throw new Error(saveErr.message);
    return { ok: true };
  });

// ============================================================
// ADMIN: atualizar apenas nome/cargo de um slot
// ============================================================
export const updateCaptacaoTeamMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { index: number; nome: string; cargo: string }) =>
    z
      .object({
        index: z.number().int().min(0).max(3),
        nome: z.string().trim().max(80),
        cargo: z.string().trim().max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "captacao_team_photos")
      .maybeSingle();
    const current: CaptacaoTeamPhoto[] = Array.isArray((cfg as { valor?: unknown } | null)?.valor)
      ? ((cfg as { valor: CaptacaoTeamPhoto[] }).valor.slice(0, 4))
      : [];
    const next = [...current];
    while (next.length <= data.index) next.push({ path: "", nome: "", cargo: "" });
    next[data.index] = { ...next[data.index], nome: data.nome, cargo: data.cargo };
    const { error } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_team_photos", valor: next as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ADMIN: remover foto de um slot
// ============================================================
export const removeCaptacaoTeamPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { index: number }) =>
    z.object({ index: z.number().int().min(0).max(3) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "captacao_team_photos")
      .maybeSingle();
    const current: CaptacaoTeamPhoto[] = Array.isArray((cfg as { valor?: unknown } | null)?.valor)
      ? ((cfg as { valor: CaptacaoTeamPhoto[] }).valor.slice(0, 4))
      : [];
    if (!current[data.index]) return { ok: true };
    const oldPath = current[data.index]?.path;
    const next = current.filter((_, i) => i !== data.index);
    if (oldPath) {
      await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);
    }
    const { error } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_team_photos", valor: next as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ADMIN helpers
// ============================================================
async function assertAdmin(context: { supabase: { rpc: (n: "has_role", p: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown }> }; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

function decodeFile(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const arquivoSchema = z.object({
  nome: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
  base64: z.string().min(1),
});

// ============================================================
// ADMIN: foto de grupo do time (única)
// ============================================================
export const uploadCaptacaoGroupPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { arquivo: { nome: string; mimeType: string; base64: string } }) =>
    z.object({ arquivo: arquivoSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "captacao_group_photo").maybeSingle();
    const old = cfg?.valor as { path?: string } | string | null;
    const oldPath = typeof old === "string" ? old : old?.path;

    const safeName = data.arquivo.nome.replace(/[^\w.\-]/g, "_");
    const path = `group/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("captacao-assets")
      .upload(path, decodeFile(data.arquivo.base64), { contentType: data.arquivo.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
    if (oldPath) await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);
    const { error } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_group_photo", valor: { path } as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCaptacaoGroupPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "captacao_group_photo").maybeSingle();
    const old = cfg?.valor as { path?: string } | string | null;
    const oldPath = typeof old === "string" ? old : old?.path;
    if (oldPath) await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);
    await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_group_photo", valor: null as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    return { ok: true };
  });

// ============================================================
// ADMIN: foto por executivo (4 slots fixos pelo ref)
// ============================================================
const execRefSchema = z.enum(CAPTACAO_EXEC_REFS);

export const uploadCaptacaoExecutivoPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ref: CaptacaoExecRef; arquivo: { nome: string; mimeType: string; base64: string } }) =>
    z.object({ ref: execRefSchema, arquivo: arquivoSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "captacao_executivo_photos").maybeSingle();
    const current = (cfg?.valor && typeof cfg.valor === "object" && !Array.isArray(cfg.valor) ? cfg.valor : {}) as Record<string, { path?: string } | string>;
    const oldEntry = current[data.ref];
    const oldPath = typeof oldEntry === "string" ? oldEntry : oldEntry?.path;

    const safeName = data.arquivo.nome.replace(/[^\w.\-]/g, "_");
    const path = `executivos/${data.ref}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("captacao-assets")
      .upload(path, decodeFile(data.arquivo.base64), { contentType: data.arquivo.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
    if (oldPath) await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);

    const next = { ...current, [data.ref]: { path } };
    const { error } = await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_executivo_photos", valor: next as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCaptacaoExecutivoPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ref: CaptacaoExecRef }) => z.object({ ref: execRefSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "captacao_executivo_photos").maybeSingle();
    const current = (cfg?.valor && typeof cfg.valor === "object" && !Array.isArray(cfg.valor) ? cfg.valor : {}) as Record<string, { path?: string } | string>;
    const entry = current[data.ref];
    const oldPath = typeof entry === "string" ? entry : entry?.path;
    if (oldPath) await supabaseAdmin.storage.from("captacao-assets").remove([oldPath]).catch(() => null);
    const next = { ...current };
    delete next[data.ref];
    await supabaseAdmin.from("configuracoes").upsert(
      { chave: "captacao_executivo_photos", valor: next as never, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    return { ok: true };
  });
