import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EscalaRow = { id: string; data: string; corretor_id: string; corretor_nome: string | null };

async function ensureAdminOrExec(ctx: { supabase: ReturnType<typeof Object>; userId: string }): Promise<{ isAdmin: boolean; isExec: boolean }> {
  const [{ data: isAdmin }, { data: isExec }] = await Promise.all([
    (ctx.supabase as { rpc: (n: string, a: unknown) => Promise<{ data: boolean | null }> })
      .rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    (ctx.supabase as { rpc: (n: string) => Promise<{ data: boolean | null }> })
      .rpc("current_user_is_executivo"),
  ]);
  if (!isAdmin && !isExec) throw new Error("Acesso negado");
  return { isAdmin: !!isAdmin, isExec: !!isExec };
}

// Para fluxos onde o corretor pode mexer apenas no PRÓPRIO slot.
async function getRoleFlags(ctx: { supabase: ReturnType<typeof Object>; userId: string }): Promise<{ isAdmin: boolean; isExec: boolean }> {
  const [{ data: isAdmin }, { data: isExec }] = await Promise.all([
    (ctx.supabase as { rpc: (n: string, a: unknown) => Promise<{ data: boolean | null }> })
      .rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    (ctx.supabase as { rpc: (n: string) => Promise<{ data: boolean | null }> })
      .rpc("current_user_is_executivo"),
  ]);
  return { isAdmin: !!isAdmin, isExec: !!isExec };
}

// Verifica se um determinado profile_id pertence a um EXECUTIVO ativo
// (mesma regra do RPC current_user_is_executivo: profile.nome match com responsaveis.nome pelo 1º nome).
async function isProfileExecutivo(
  admin: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } },
  profileId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("nome, ativo, responsavel_id, responsaveis:responsavel_id(nome, ativo)")
    .eq("id", profileId)
    .maybeSingle();
  const p = data as { nome: string | null; ativo: boolean | null; responsavel_id: string | null; responsaveis: { nome: string | null; ativo: boolean | null } | null } | null;
  if (!p || p.ativo === false || !p.responsavel_id || !p.responsaveis) return false;
  if (p.responsaveis.ativo === false) return false;
  const first = (s: string | null) => (s ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return first(p.nome) !== "" && first(p.nome) === first(p.responsaveis.nome);
}

// Verifica se um profile_id tem role admin
async function isProfileAdmin(
  admin: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } },
  profileId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", profileId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}


export const getEscalaMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inicio = `${data.ano}-${String(data.mes).padStart(2, "0")}-01`;
    const fim = new Date(data.ano, data.mes, 1).toISOString().slice(0, 10);
    const { data: rows, error } = await supabaseAdmin
      .from("plantao_escala" as never)
      .select("id, data, corretor_id")
      .gte("data", inicio).lt("data", fim);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as { id: string; data: string; corretor_id: string }[];
    const ids = Array.from(new Set(list.map((r) => r.corretor_id)));
    let nomes = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", ids);
      nomes = new Map((profs ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
    }
    void context;
    return { items: list.map((r) => ({ ...r, corretor_nome: nomes.get(r.corretor_id) ?? null })) as EscalaRow[] };
  });

export const setPlantonista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), corretor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { isAdmin, isExec } = await getRoleFlags(context);
    // Corretor puro: só pode se escalar a si mesmo.
    if (!isAdmin && !isExec && data.corretor_id !== context.userId) {
      throw new Error("Você só pode se escalar a si mesmo no plantão.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Detecta se já existia plantonista diferente para o mesmo dia (troca)
    const { data: prevRaw } = await supabaseAdmin
      .from("plantao_escala" as never)
      .select("corretor_id")
      .eq("data", data.data)
      .maybeSingle();
    const prev = prevRaw as { corretor_id: string } | null;
    // Corretor puro: não pode sobrescrever slot de NINGUÉM (só ocupar slot vazio ou trocar o próprio).
    if (!isAdmin && !isExec && prev && prev.corretor_id !== context.userId) {
      throw new Error("Você não pode alterar a escala de outra pessoa.");
    }
    // Executivo: NÃO pode sobrescrever um dia escalado para OUTRO executivo ou para um ADMIN.
    if (!isAdmin && isExec && prev && prev.corretor_id !== context.userId && prev.corretor_id !== data.corretor_id) {
      const [prevIsExec, prevIsAdmin] = await Promise.all([
        isProfileExecutivo(supabaseAdmin as never, prev.corretor_id),
        isProfileAdmin(supabaseAdmin as never, prev.corretor_id),
      ]);
      if (prevIsAdmin) throw new Error("Apenas Admin pode alterar a escala de outro Admin.");
      if (prevIsExec) throw new Error("Apenas Admin pode alterar a escala de outro Executivo.");
    }
    // upsert por data — zera `notificado_em` se trocou de corretor para que o aviso saia
    const changed = !prev || prev.corretor_id !== data.corretor_id;
    const { error } = await supabaseAdmin
      .from("plantao_escala" as never)
      .upsert({
        data: data.data,
        corretor_id: data.corretor_id,
        criado_por: context.userId,
        ...(changed ? { notificado_em: null } : {}),
      } as never, { onConflict: "data" });
    if (error) throw new Error(error.message);

    // Se a alteração afeta o DIA DE HOJE e o plantonista mudou, dispara push imediato
    const nowBrt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hojeStr = `${nowBrt.getUTCFullYear()}-${String(nowBrt.getUTCMonth() + 1).padStart(2, "0")}-${String(nowBrt.getUTCDate()).padStart(2, "0")}`;
    if (changed && data.data === hojeStr) {
      try {
        const { data: profRaw } = await supabaseAdmin
          .from("profiles")
          .select("nome, onesignal_external_id")
          .eq("id", data.corretor_id)
          .maybeSingle();
        const prof = profRaw as { nome: string; onesignal_external_id: string | null } | null;
        if (prof?.onesignal_external_id) {
          const { sendOneSignalPush } = await import("@/lib/onesignal.server");
          const primeiroNome = (prof.nome || "").trim().split(/\s+/)[0] || "Plantonista";
          await sendOneSignalPush({
            externalIds: [prof.onesignal_external_id],
            title: "🔄 Você assumiu o plantão agora!",
            message: `${primeiroNome}, você é o plantonista de hoje a partir de agora.`,
            url: "https://sistemanexus.app/vendas",
            data: { tipo: "plantao_troca_turno", data: hojeStr },
          });
          await supabaseAdmin
            .from("plantao_escala" as never)
            .update({ notificado_em: new Date().toISOString() } as never)
            .eq("data", hojeStr);
        }
      } catch (e) {
        console.warn("[plantao] push troca turno falhou", e);
      }
    }
    return { ok: true };
  });


export const removerPlantonista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureAdminOrExec(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Regra: Executivo NÃO pode remover dia escalado para OUTRO executivo ou para um ADMIN.
    if (!isAdmin) {
      const { data: prevRaw } = await supabaseAdmin
        .from("plantao_escala" as never)
        .select("corretor_id")
        .eq("data", data.data)
        .maybeSingle();
      const prev = prevRaw as { corretor_id: string } | null;
      if (prev && prev.corretor_id !== context.userId) {
        const [prevIsExec, prevIsAdmin] = await Promise.all([
          isProfileExecutivo(supabaseAdmin as never, prev.corretor_id),
          isProfileAdmin(supabaseAdmin as never, prev.corretor_id),
        ]);
        if (prevIsAdmin) throw new Error("Apenas Admin pode remover a escala de outro Admin.");
        if (prevIsExec) throw new Error("Apenas Admin pode remover a escala de outro Executivo.");
      }
    }
    const { error } = await supabaseAdmin.from("plantao_escala" as never).delete().eq("data", data.data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCorretoresElegiveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdminOrExec(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // corretor_vendas + corretor (legado) + executivos + qualquer usuário marcado "Elegível para Plantão"
    const [{ data: roles }, { data: execs }, { data: elegiveis }, { data: adminRoles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["corretor_vendas", "corretor"]),
      supabaseAdmin.from("profiles")
        .select("id, nome, responsavel_id, ativo, responsaveis:responsavel_id(id, nome, ativo)")
        .not("responsavel_id", "is", null),
      supabaseAdmin.from("profiles").select("id, ativo, plantao_elegivel").eq("plantao_elegivel", true),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const ids = new Set<string>((roles ?? []).map((r: { user_id: string }) => r.user_id));
    const execIds = new Set<string>();
    for (const p of (execs ?? []) as { id: string; nome: string; ativo: boolean | null; responsaveis: { nome: string; ativo: boolean | null } | null }[]) {
      const resp = p.responsaveis;
      if (!resp || resp.ativo === false || p.ativo === false) continue;
      if ((resp.nome ?? "").trim().split(/\s+/)[0]?.toLowerCase() === (p.nome ?? "").trim().split(/\s+/)[0]?.toLowerCase()) {
        ids.add(p.id);
        execIds.add(p.id);
      }
    }
    for (const p of (elegiveis ?? []) as { id: string; ativo: boolean | null }[]) {
      if (p.ativo !== false) ids.add(p.id);
    }
    const adminIds = new Set<string>(((adminRoles ?? []) as { user_id: string }[]).map((r) => r.user_id));
    // garante que admins escalados também apareçam (pra UI conseguir resolver flags pelo id)
    for (const a of adminIds) ids.add(a);
    if (!ids.size) return { items: [] as { id: string; nome: string; is_admin: boolean; is_exec: boolean }[] };
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome, ativo").in("id", Array.from(ids));
    const items = ((profs ?? []) as { id: string; nome: string; ativo: boolean | null }[])
      .filter((p) => p.ativo !== false)
      .map((p) => ({ id: p.id, nome: p.nome, is_admin: adminIds.has(p.id), is_exec: execIds.has(p.id) }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { items };
  });

export const getPlantonistaHoje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Data "hoje" no fuso de Brasília (UTC-3)
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoje = `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}-${String(brt.getUTCDate()).padStart(2, "0")}`;
    const { data: esc } = await supabaseAdmin
      .from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
    const corretorId = (esc as { corretor_id: string } | null)?.corretor_id ?? null;
    if (!corretorId) return { data: hoje, corretor_id: null, corretor_nome: null, eu_sou: false };
    const { data: p } = await supabaseAdmin.from("profiles").select("nome").eq("id", corretorId).maybeSingle();
    return {
      data: hoje,
      corretor_id: corretorId,
      corretor_nome: (p as { nome: string } | null)?.nome ?? null,
      eu_sou: corretorId === context.userId,
    };
  });


export const getMeusLeadsPlantao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("vendas_leads")
      .select("id, atribuicao_status")
      .eq("corretor_id", context.userId)
      .eq("plantao_dia" as never, hoje);
    const list = (rows ?? []) as { id: string; atribuicao_status: string | null }[];
    return {
      total: list.length,
      aceitos: list.filter((l) => l.atribuicao_status === "aceito").length,
      pendentes: list.filter((l) => l.atribuicao_status === "pendente").length,
    };
  });
