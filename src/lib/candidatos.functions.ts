import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REGIOES = [
  "barra_da_tijuca",
  "recreio",
  "jacarepagua",
  "zona_sul",
  "zona_norte",
  "zona_oeste",
  "centro",
  "outras",
  "belford_roxo",
  "nilopolis",
  "mesquita",
] as const;

const REGIOES_LABEL: Record<(typeof REGIOES)[number], string> = {
  barra_da_tijuca: "Barra da Tijuca",
  recreio: "Recreio dos Bandeirantes",
  jacarepagua: "Jacarepaguá",
  zona_sul: "Zona Sul",
  zona_norte: "Zona Norte",
  zona_oeste: "Zona Oeste",
  centro: "Centro",
  outras: "Outras",
  belford_roxo: "Belford Roxo",
  nilopolis: "Nilópolis",
  mesquita: "Mesquita",
};

// Mapa região → canal (executivo) usado no enum lead_canal
const CANAL_POR_REGIAO: Partial<Record<(typeof REGIOES)[number], "robson" | "fabiola" | "renata" | "denise">> = {
  barra_da_tijuca: "robson",
  recreio: "fabiola",
  belford_roxo: "renata",
  nilopolis: "denise",
  mesquita: "denise",
};

// ============================================================
// 1. SUBMISSÃO PÚBLICA (sem login) — /ingresso
// ============================================================
export const submeterCandidato = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      nome: string;
      cpf: string;
      telefone: string;
      email?: string;
      creci?: string;
      regiao: (typeof REGIOES)[number];
      arquivos: {
        rg?: { nome: string; mimeType: string; base64: string };
        cpf?: { nome: string; mimeType: string; base64: string };
        creci?: { nome: string; mimeType: string; base64: string };
        comprovante?: { nome: string; mimeType: string; base64: string };
      };
    }) =>
      z
        .object({
          nome: z.string().trim().min(3).max(150),
          cpf: z.string().trim().min(11).max(20),
          telefone: z.string().trim().min(10).max(20),
          email: z.string().trim().email().max(255).optional().or(z.literal("")),
          creci: z.string().trim().max(50).optional().or(z.literal("")),
          regiao: z.enum(REGIOES),
          arquivos: z.object({
            rg: z
              .object({
                nome: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(150),
                base64: z.string().min(1),
              })
              .optional(),
            cpf: z
              .object({
                nome: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(150),
                base64: z.string().min(1),
              })
              .optional(),
            creci: z
              .object({
                nome: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(150),
                base64: z.string().min(1),
              })
              .optional(),
            comprovante: z
              .object({
                nome: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(150),
                base64: z.string().min(1),
              })
              .optional(),
          }),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Resolve executivo da região
    const { data: mapa } = await supabaseAdmin
      .from("regiao_responsavel" as never)
      .select("responsavel_id")
      .eq("regiao", data.regiao)
      .maybeSingle();
    const responsavelId = (mapa as { responsavel_id: string } | null)?.responsavel_id ?? null;

    // 2) Procura lead existente por telefone OU CPF
    const telefoneClean = data.telefone.replace(/\D/g, "");
    const cpfClean = data.cpf.replace(/\D/g, "");

    type LeadRow = {
      id: string;
      responsavel_id: string | null;
      dados_corretor: Record<string, unknown> | null;
    };

    let lead: LeadRow | null = null;
    const { data: byTel } = await supabaseAdmin
      .from("leads")
      .select("id, responsavel_id, dados_corretor")
      .ilike("telefone", `%${telefoneClean.slice(-10)}%`)
      .limit(1)
      .maybeSingle();
    if (byTel) lead = byTel as unknown as LeadRow;

    if (!lead && cpfClean) {
      // tenta achar por cpf dentro de dados_corretor
      const { data: all } = await supabaseAdmin
        .from("leads")
        .select("id, responsavel_id, dados_corretor")
        .eq("is_corretor", true)
        .limit(500);
      const found = ((all ?? []) as unknown as LeadRow[]).find((l) => {
        const dc = l.dados_corretor as Record<string, unknown> | null;
        const cpfLead = String(dc?.cpf ?? "").replace(/\D/g, "");
        return cpfLead && cpfLead === cpfClean;
      });
      if (found) lead = found;
    }

    // 3) Cria ou atualiza lead
    const dadosCorretor = {
      ...(lead?.dados_corretor ?? {}),
      cpf: cpfClean,
      creci_numero: data.creci ?? null,
      documentos_enviados_em: new Date().toISOString(),
    };

    let leadId: string;
    if (lead) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from("leads")
        .update({
          nome: data.nome,
          telefone: data.telefone,
          email: data.email || null,
          creci: data.creci || null,
          regiao: data.regiao,
          etapa: "documentos_enviados",
          is_corretor: true,
          dados_corretor: dadosCorretor,
        })
        .eq("id", lead.id)
        .select("id")
        .maybeSingle();
      if (updErr || !upd) throw new Error(updErr?.message || "Falha ao atualizar lead");
      leadId = upd.id;
    } else {
      const canal = CANAL_POR_REGIAO[data.regiao] ?? "robson";
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("leads")
        .insert({
          nome: data.nome,
          telefone: data.telefone,
          email: data.email || null,
          creci: data.creci || null,
          regiao: data.regiao,
          canal,
          etapa: "documentos_enviados",
          is_corretor: true,
          responsavel_id: responsavelId,
          dados_corretor: dadosCorretor,
          origem: "landing_page_ingresso",
        })
        .select("id")
        .maybeSingle();
      if (insErr || !ins) throw new Error(insErr?.message || "Falha ao criar lead");
      leadId = ins.id;
    }

    // 4) Upload dos 4 arquivos pro Storage
    const tempId = crypto.randomUUID();
    const basePath = `${tempId}`;

    async function uploadOne(
      slot: "rg" | "cpf" | "creci" | "comprovante",
      file: { nome: string; mimeType: string; base64: string } | undefined,
    ): Promise<string | null> {
      if (!file) return null;
      const bin = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const safeName = file.nome.replace(/[^\w.\-]/g, "_");
      const path = `${basePath}/${slot}-${safeName}`;
      const { error } = await supabaseAdmin.storage
        .from("candidatos-docs")
        .upload(path, bin, { contentType: file.mimeType, upsert: false });
      if (error) throw new Error(`Falha no upload ${slot}: ${error.message}`);
      return path;
    }

    const [rgPath, cpfPath, creciPath, compPath] = await Promise.all([
      uploadOne("rg", data.arquivos.rg),
      uploadOne("cpf", data.arquivos.cpf),
      uploadOne("creci", data.arquivos.creci),
      uploadOne("comprovante", data.arquivos.comprovante),
    ]);

    // 5) Cria row em candidatos
    const { data: cand, error: candErr } = await supabaseAdmin
      .from("candidatos" as never)
      .insert({
        nome: data.nome,
        cpf: cpfClean,
        telefone: data.telefone,
        email: data.email || null,
        creci: data.creci || null,
        regiao: data.regiao,
        rg_path: rgPath,
        cpf_path: cpfPath,
        creci_path: creciPath,
        comprovante_path: compPath,
        lead_id: leadId,
        responsavel_id: responsavelId,
        status: "pendente_revisao",
      } as never)
      .select("id")
      .maybeSingle();
    if (candErr || !cand) throw new Error(candErr?.message || "Falha ao registrar candidato");

    // 6) Push notification — destinatários FIXOS: Wederson, Iuri, Larissa
    try {
      const { sendOneSignalPush } = await import("@/lib/onesignal.server");

      const NOMES_ALVO = ["wederson", "iuri", "larissa"];
      const { data: profsAll } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, onesignal_external_id");
      const matched = ((profsAll ?? []) as { id: string; nome: string | null; onesignal_external_id: string | null }[])
        .filter((p) => NOMES_ALVO.some((n) => (p.nome ?? "").toLowerCase().includes(n)));

      const externalIds = matched
        .map((p) => p.onesignal_external_id)
        .filter((x): x is string => !!x);
      const semExternalId = matched.filter((p) => !p.onesignal_external_id).map((p) => p.nome);

      console.info("[submeterCandidato] push destinatários", {
        encontrados: matched.map((p) => p.nome),
        externalIds,
        semExternalId,
      });

      if (externalIds.length) {
        const result = await sendOneSignalPush({
          externalIds,
          title: "📄 Novo candidato enviou documentação!",
          message: `Nome: ${data.nome} | Região: ${REGIOES_LABEL[data.regiao]}`,
          url: "/administrativo/candidatos",
          data: { candidato_id: (cand as { id: string }).id, lead_id: leadId },
        });
        console.info("[submeterCandidato] push result", { ok: result.ok, error: result.error });
      } else {
        console.warn("[submeterCandidato] sem destinatários com onesignal_external_id", { semExternalId });
      }
    } catch (err) {
      console.error("[submeterCandidato] push failed", err);
    }

    return { ok: true, candidatoId: (cand as { id: string }).id };
  });

// ============================================================
// 2. ADMIN — LISTAR CANDIDATOS
// ============================================================
async function assertCanViewCandidatos(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("can_view_candidatos", { _user_id: userId });
  if (error || data !== true) throw new Error("Forbidden");
}

export const listCandidatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: "pendente_revisao" | "arquivado" | "todos" }) =>
    z.object({ status: z.enum(["pendente_revisao", "arquivado", "todos"]).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanViewCandidatos(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("candidatos" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "todos") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { candidatos: (rows ?? []) as unknown as CandidatoRow[] };
  });

export type CandidatoRow = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  creci: string | null;
  regiao: string;
  rg_path: string | null;
  cpf_path: string | null;
  creci_path: string | null;
  comprovante_path: string | null;
  status: "pendente_revisao" | "arquivado";
  lead_id: string | null;
  responsavel_id: string | null;
  drive_folder_id: string | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// 3. SIGNED URLS pros documentos do candidato
// ============================================================
export const getCandidatoDocUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidatoId: string }) =>
    z.object({ candidatoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanViewCandidatos(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand, error } = await supabaseAdmin
      .from("candidatos" as never)
      .select("rg_path, cpf_path, creci_path, comprovante_path")
      .eq("id", data.candidatoId)
      .maybeSingle();
    if (error || !cand) throw new Error("Candidato não encontrado");
    const c = cand as {
      rg_path: string | null;
      cpf_path: string | null;
      creci_path: string | null;
      comprovante_path: string | null;
    };
    async function sign(p: string | null) {
      if (!p) return null;
      const { data: s } = await supabaseAdmin.storage
        .from("candidatos-docs")
        .createSignedUrl(p, 60 * 30);
      return s?.signedUrl ?? null;
    }
    return {
      rg: await sign(c.rg_path),
      cpf: await sign(c.cpf_path),
      creci: await sign(c.creci_path),
      comprovante: await sign(c.comprovante_path),
    };
  });

// ============================================================
// 4. SALVAR NO GOOGLE DRIVE (usa OAuth do usuário logado)
// ============================================================
export const salvarCandidatoNoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidatoId: string }) =>
    z.object({ candidatoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanViewCandidatos(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cand, error } = await supabaseAdmin
      .from("candidatos" as never)
      .select("id, nome, cpf, regiao, rg_path, cpf_path, creci_path, comprovante_path, drive_folder_id")
      .eq("id", data.candidatoId)
      .maybeSingle();
    if (error || !cand) throw new Error("Candidato não encontrado");
    const c = cand as {
      id: string;
      nome: string;
      cpf: string;
      regiao: string;
      rg_path: string | null;
      cpf_path: string | null;
      creci_path: string | null;
      comprovante_path: string | null;
      drive_folder_id: string | null;
    };

    const { getValidAccessToken } = await import("@/lib/google.server");
    const { uploadFileToDrive } = await import("@/lib/drive.server");
    const token = await getValidAccessToken(context.userId);
    if (!token) throw new Error("Sua conta Google não está conectada. Vá em Configurações → Google.");

    // ensure root folders
    const DRIVE_API = "https://www.googleapis.com/drive/v3";
    const FOLDER_MIME = "application/vnd.google-apps.folder";

    async function findOrCreate(parent: string, name: string): Promise<string> {
      const q = `mimeType='${FOLDER_MIME}' and trashed=false and '${parent}' in parents and name='${name.replace(/'/g, "\\'")}'`;
      const res = await fetch(
        `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
      const j = (await res.json()) as { files?: { id: string }[] };
      if (j.files?.[0]?.id) return j.files[0].id;
      const cres = await fetch(`${DRIVE_API}/files?fields=id`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
      });
      if (!cres.ok) throw new Error(`Drive create folder failed: ${cres.status}`);
      const cj = (await cres.json()) as { id: string };
      return cj.id;
    }

    const rootId = await findOrCreate("root", "Captação Corretores");
    const candFolder = c.drive_folder_id ?? (await findOrCreate(rootId, c.nome));

    // Baixa do Storage e sobe pro Drive
    async function copyToDrive(
      slot: "RG" | "CPF" | "CRECI" | "Comprovante",
      path: string | null,
    ) {
      if (!path) return null;
      const { data: blob, error: dErr } = await supabaseAdmin.storage
        .from("candidatos-docs")
        .download(path);
      if (dErr || !blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const filename = path.split("/").pop() ?? `${slot}.bin`;
      const result = await uploadFileToDrive(token!, candFolder, {
        name: `${slot} - ${filename}`,
        mimeType: blob.type || "application/octet-stream",
        bytes,
      });
      // registra em documentos
      await supabaseAdmin.from("documentos" as never).insert({
        tipo: slot.toLowerCase() === "creci" ? "outro" : slot.toLowerCase(),
        nome: filename,
        mime_type: blob.type || null,
        tamanho_bytes: bytes.length,
        drive_file_id: result.id,
        drive_web_view_link: result.webViewLink,
        uploaded_by: context.userId,
      } as never);
      return result;
    }

    await Promise.all([
      copyToDrive("RG", c.rg_path),
      copyToDrive("CPF", c.cpf_path),
      copyToDrive("CRECI", c.creci_path),
      copyToDrive("Comprovante", c.comprovante_path),
    ]);

    await supabaseAdmin
      .from("candidatos" as never)
      .update({
        drive_folder_id: candFolder,
        status: "arquivado",
        arquivado_em: new Date().toISOString(),
        arquivado_por: context.userId,
      } as never)
      .eq("id", c.id);

    return { ok: true, driveFolderId: candFolder };
  });

// ============================================================
// 4b. EXCLUIR CANDIDATO (remove row + arquivos do Storage; mantém lead)
// ============================================================
export const excluirCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidatoId: string }) =>
    z.object({ candidatoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanViewCandidatos(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cand, error } = await supabaseAdmin
      .from("candidatos" as never)
      .select("id, rg_path, cpf_path, creci_path, comprovante_path")
      .eq("id", data.candidatoId)
      .maybeSingle();
    if (error || !cand) throw new Error("Candidato não encontrado");
    const c = cand as {
      id: string;
      rg_path: string | null;
      cpf_path: string | null;
      creci_path: string | null;
      comprovante_path: string | null;
    };

    const paths = [c.rg_path, c.cpf_path, c.creci_path, c.comprovante_path].filter(
      (p): p is string => !!p,
    );
    if (paths.length) {
      const { error: sErr } = await supabaseAdmin.storage.from("candidatos-docs").remove(paths);
      if (sErr) console.warn("[excluirCandidato] storage remove falhou", sErr.message);
    }

    const { error: dErr } = await supabaseAdmin
      .from("candidatos" as never)
      .delete()
      .eq("id", c.id);
    if (dErr) throw new Error(dErr.message);

    return { ok: true };
  });

// ============================================================
// 5. CONFIG VSL URL (público para leitura na LP, admin para escrita)
// ============================================================
export const getVslUrl = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["vsl_youtube_url", "vsl_allow_skip"]);
  let url = "";
  let allowSkip = false;
  for (const row of data ?? []) {
    if (row.chave === "vsl_youtube_url") {
      const v = row.valor as string | { url?: string } | null;
      url = typeof v === "string" ? v : (v?.url ?? "");
    } else if (row.chave === "vsl_allow_skip") {
      const v = row.valor as boolean | string | { value?: boolean } | null;
      allowSkip = v === true || v === "true" || (typeof v === "object" && v?.value === true);
    }
  }
  return { url, allowSkip };
});

export const setVslUrl = createServerFn({ method: "POST" })
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
    const { error } = await supabaseAdmin
      .from("configuracoes")
      .upsert(
        { chave: "vsl_youtube_url", valor: data.url as never, updated_at: new Date().toISOString() },
        { onConflict: "chave" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setVslAllowSkip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { allowSkip: boolean }) =>
    z.object({ allowSkip: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("configuracoes")
      .upsert(
        { chave: "vsl_allow_skip", valor: data.allowSkip as never, updated_at: new Date().toISOString() },
        { onConflict: "chave" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type InstitucionalCandidato = {
  lead_id: string;
  nome: string;
  telefone: string;
  executivo: string | null;
};

export type InstitucionalReuniaoInfo = {
  id: string;
  titulo: string;
  data_inicio: string;
  is_today: boolean;
  candidatos: InstitucionalCandidato[];
} | null;

export const listInstitucionalCandidatos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ reuniao: InstitucionalReuniaoInfo }> => {
    // Authorize: admin, administrativo, or executivo
    const [{ data: isAdmin }, { data: roleRow }, { data: isExec }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      context.supabase.rpc("current_user_is_executivo"),
    ]);
    const isAdministrativo = (roleRow?.role as string | undefined) === "administrativo";
    if (!isAdmin && !isAdministrativo && isExec !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // "Hoje" no fuso America/Sao_Paulo (UTC-3, sem DST).
    // Pegamos o Y-M-D em SP e convertemos os limites do dia de volta para UTC.
    const tzParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const y = tzParts.find((p) => p.type === "year")!.value;
    const m = tzParts.find((p) => p.type === "month")!.value;
    const d = tzParts.find((p) => p.type === "day")!.value;
    // 00:00 e 23:59:59.999 em SP == 03:00 e 02:59:59.999 (dia seguinte) em UTC
    const startToday = new Date(`${y}-${m}-${d}T00:00:00-03:00`);
    const endToday = new Date(`${y}-${m}-${d}T23:59:59.999-03:00`);

    // Today's institucional, else most recent past
    const { data: hoje } = await supabaseAdmin
      .from("reunioes")
      .select("id, titulo, data_inicio")
      .eq("tipo", "institucional")
      .gte("data_inicio", startToday.toISOString())
      .lte("data_inicio", endToday.toISOString())
      .order("data_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reuniao = hoje as { id: string; titulo: string; data_inicio: string } | null;
    const isToday = !!reuniao;

    if (!reuniao) return { reuniao: null };


    const { data: parts } = await supabaseAdmin
      .from("reuniao_participantes")
      .select("lead_id")
      .eq("reuniao_id", reuniao.id)
      .not("lead_id", "is", null);

    const leadIds = ((parts ?? []) as { lead_id: string | null }[])
      .map((p) => p.lead_id).filter((x): x is string => !!x);

    let candidatos: InstitucionalCandidato[] = [];
    if (leadIds.length) {
      const { data: leads } = await supabaseAdmin
        .from("leads")
        .select("id, nome, telefone, responsavel_id")
        .in("id", leadIds);
      const respIds = Array.from(new Set(((leads ?? []) as { responsavel_id: string | null }[])
        .map((l) => l.responsavel_id).filter((x): x is string => !!x)));
      let respMap = new Map<string, string>();
      if (respIds.length) {
        const { data: resps } = await supabaseAdmin
          .from("responsaveis").select("id, nome").in("id", respIds);
        respMap = new Map(((resps ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome]));
      }
      candidatos = ((leads ?? []) as { id: string; nome: string; telefone: string; responsavel_id: string | null }[])
        .map((l) => ({
          lead_id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          executivo: l.responsavel_id ? respMap.get(l.responsavel_id) ?? null : null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return {
      reuniao: {
        id: reuniao.id,
        titulo: reuniao.titulo,
        data_inicio: reuniao.data_inicio,
        is_today: isToday,
        candidatos,
      },
    };
  });
