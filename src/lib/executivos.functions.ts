import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

const ETAPAS_ATIVAS = ["novo", "atendimento", "qualificado", "proposta", "visita_agendada", "proposta_enviada", "negociacao"];

export const listExecutivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: execs } = await supabaseAdmin
      .from("responsaveis")
      .select("id, nome, canal, whatsapp, ativo, regiao")
      .order("nome");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, responsavel_id, ativo");

    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("responsavel_id, etapa");

    const corretorCount = new Map<string, number>();
    (profiles ?? []).forEach((p) => {
      if (p.responsavel_id) corretorCount.set(p.responsavel_id, (corretorCount.get(p.responsavel_id) ?? 0) + 1);
    });

    const leadsAtivosCount = new Map<string, number>();
    (leads ?? []).forEach((l) => {
      if (l.responsavel_id && ETAPAS_ATIVAS.includes(l.etapa)) {
        leadsAtivosCount.set(l.responsavel_id, (leadsAtivosCount.get(l.responsavel_id) ?? 0) + 1);
      }
    });

    return (execs ?? []).map((e) => ({
      ...e,
      total_corretores: corretorCount.get(e.id) ?? 0,
      leads_ativos: leadsAtivosCount.get(e.id) ?? 0,
    }));
  });

export const getExecutivoDetalhe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: exec } = await supabaseAdmin
      .from("responsaveis")
      .select("id, nome, canal, whatsapp, ativo, regiao")
      .eq("id", data.id)
      .maybeSingle();
    if (!exec) throw new Error("Executivo não encontrado");

    const { data: corretores } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, ativo, responsavel_id")
      .eq("responsavel_id", data.id)
      .order("nome");

    const corretorIds = (corretores ?? []).map((c) => c.id);
    const { data: vendasLeads } = corretorIds.length
      ? await supabaseAdmin.from("vendas_leads").select("corretor_id, etapa").in("corretor_id", corretorIds)
      : { data: [] };

    const leadsPorCorretor = new Map<string, { total: number; ativos: number; fechados: number }>();
    (vendasLeads ?? []).forEach((l) => {
      if (!l.corretor_id) return;
      const cur = leadsPorCorretor.get(l.corretor_id) ?? { total: 0, ativos: 0, fechados: 0 };
      cur.total += 1;
      if (l.etapa === "fechado") cur.fechados += 1;
      else if (l.etapa !== "perdido") cur.ativos += 1;
      leadsPorCorretor.set(l.corretor_id, cur);
    });

    const corretoresEnriched = (corretores ?? []).map((c) => ({
      ...c,
      stats: leadsPorCorretor.get(c.id) ?? { total: 0, ativos: 0, fechados: 0 },
    }));

    const equipeStats = corretoresEnriched.reduce(
      (acc, c) => ({
        total: acc.total + c.stats.total,
        ativos: acc.ativos + c.stats.ativos,
        fechados: acc.fechados + c.stats.fechados,
      }),
      { total: 0, ativos: 0, fechados: 0 }
    );

    return { executivo: exec, corretores: corretoresEnriched, equipeStats };
  });

export const listCorretoresDisponiveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["corretor", "corretor_vendas"]);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, ativo, responsavel_id")
      .in("id", ids)
      .order("nome");

    const { data: execs } = await supabaseAdmin.from("responsaveis").select("id, nome");
    const execMap = new Map((execs ?? []).map((e) => [e.id, e.nome]));

    return (profiles ?? []).map((p) => ({
      ...p,
      executivo_nome: p.responsavel_id ? execMap.get(p.responsavel_id) ?? null : null,
    }));
  });

export const setCorretorExecutivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    corretor_id: z.string().uuid(),
    executivo_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ responsavel_id: data.executivo_id })
      .eq("id", data.corretor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateExecutivoRegiao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    regiao: z.string().trim().max(200).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("responsaveis")
      .update({ regiao: data.regiao })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
