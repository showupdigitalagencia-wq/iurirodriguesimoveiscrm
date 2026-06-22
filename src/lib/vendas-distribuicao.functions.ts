import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CorretorAvail = {
  id: string;
  nome: string;
  disponivel_agora: boolean;
  leads_ativos: number;
  recusou: boolean;
};

function nowAvailable(
  rows: { tipo: string; dia_semana: number | null; data: string | null; hora_inicio: string | null; hora_fim: string | null }[],
  at: Date,
): boolean {
  const dia = at.getDay();
  const ymd = at.toISOString().slice(0, 10);
  const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const within = (a: string | null, b: string | null) =>
    (!a || hhmm >= a) && (!b || hhmm <= b);
  // Bloqueado se há bloqueio cobrindo o horário
  for (const r of rows) {
    if (r.tipo !== "bloqueio") continue;
    if (r.data !== ymd) continue;
    if (within(r.hora_inicio, r.hora_fim)) return false;
  }
  // Disponível se há janela recorrente cobrindo o horário
  for (const r of rows) {
    if (r.tipo !== "recorrente") continue;
    if (r.dia_semana !== dia) continue;
    if (within(r.hora_inicio, r.hora_fim)) return true;
  }
  return false;
}

export const listCorretoresDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid().optional(), at: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    const at = data.at ? new Date(data.at) : new Date();

    // corretores ativos (role corretor ou corretor_vendas)
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id, role").in("role", ["corretor", "corretor_vendas"]);
    const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (!userIds.length) return { items: [] as CorretorAvail[] };

    const [{ data: profiles }, { data: disp }, { data: leadsAtivos }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nome, ativo").in("id", userIds),
      supabaseAdmin.from("corretor_disponibilidade" as never)
        .select("corretor_id, tipo, dia_semana, data, hora_inicio, hora_fim").in("corretor_id", userIds),
      supabaseAdmin.from("vendas_leads")
        .select("corretor_id, atribuicao_status").in("corretor_id", userIds),
    ]);

    let recusas: string[] = [];
    if (data.lead_id) {
      const { data: leadRow } = await supabaseAdmin
        .from("vendas_leads").select("recusas").eq("id", data.lead_id).maybeSingle();
      recusas = ((leadRow?.recusas as unknown) as string[] | undefined) ?? [];
    }

    const dispBy = new Map<string, { tipo: string; dia_semana: number | null; data: string | null; hora_inicio: string | null; hora_fim: string | null }[]>();
    for (const r of (disp ?? []) as { corretor_id: string; tipo: string; dia_semana: number | null; data: string | null; hora_inicio: string | null; hora_fim: string | null }[]) {
      const arr = dispBy.get(r.corretor_id) ?? [];
      arr.push(r); dispBy.set(r.corretor_id, arr);
    }
    const ativosBy = new Map<string, number>();
    for (const l of (leadsAtivos ?? []) as { corretor_id: string; atribuicao_status: string | null }[]) {
      if (l.atribuicao_status === "aceito" || l.atribuicao_status === "pendente") {
        ativosBy.set(l.corretor_id, (ativosBy.get(l.corretor_id) ?? 0) + 1);
      }
    }

    const items: CorretorAvail[] = ((profiles ?? []) as { id: string; nome: string; ativo: boolean | null }[])
      .filter((p) => p.ativo !== false)
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        disponivel_agora: nowAvailable(dispBy.get(p.id) ?? [], at),
        leads_ativos: ativosBy.get(p.id) ?? 0,
        recusou: recusas.includes(p.id),
      }))
      .sort((a, b) => Number(b.disponivel_agora) - Number(a.disponivel_agora) || a.leads_ativos - b.leads_ativos);

    return { items };
  });

export const atribuirLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid(), corretor_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    // Captura corretor anterior para registrar transferência
    const { data: prevRaw } = await supabaseAdmin
      .from("vendas_leads").select("corretor_id").eq("id", data.lead_id).maybeSingle();
    const prevCorretorId = (prevRaw as { corretor_id: string | null } | null)?.corretor_id ?? null;

    const { data: updated, error } = await supabaseAdmin
      .from("vendas_leads")
      .update({
        corretor_id: data.corretor_id,
        atribuicao_status: "pendente",
        atribuido_em: new Date().toISOString(),
        atribuido_por: context.userId,
      } as never)
      .eq("id", data.lead_id)
      .select("nome, telefone, regiao")
      .single();
    if (error) throw new Error(error.message);

    // Histórico de transferência (apenas quando houve troca real de corretor)
    if (prevCorretorId && prevCorretorId !== data.corretor_id) {
      const ids = Array.from(new Set([prevCorretorId, data.corretor_id, context.userId]));
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", ids);
      const map = new Map<string, string>(
        ((profs ?? []) as { id: string; nome: string | null }[]).map((p) => [p.id, p.nome ?? ""]),
      );
      const anteriorNome = map.get(prevCorretorId) ?? "corretor anterior";
      const novoNome = map.get(data.corretor_id) ?? "novo corretor";
      const porNome = map.get(context.userId) ?? "administrador";
      await supabaseAdmin.from("plantao_log" as never).insert({
        lead_id: data.lead_id,
        corretor_id: data.corretor_id,
        motivo: "redirecionamento_demora",
        origem: "manual",
        detalhe: {
          mensagem: `Lead transferido de ${anteriorNome} para ${novoNome} por ${porNome}.`,
          motivo: "reatribuicao_manual",
          de: { id: prevCorretorId, nome: anteriorNome },
          para: { id: data.corretor_id, nome: novoNome },
          por: { id: context.userId, nome: porNome },
          atribuido_em: new Date().toISOString(),
        } as never,
      } as never);
    }

    // Push DIRECIONADO ao corretor atribuído via external_id (não mais broadcast "All")
    try {
      const [{ data: corretorProf }, { data: roles }] = await Promise.all([
        supabaseAdmin.from("profiles").select("nome, onesignal_external_id").eq("id", data.corretor_id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const lead = updated as { nome: string; telefone: string; regiao: string };
      const url = "https://sistemanexus.app/vendas/leads";
      const corretorExt = (corretorProf as { nome: string; onesignal_external_id: string | null } | null)?.onesignal_external_id ?? null;
      const corretorNome = (corretorProf as { nome: string } | null)?.nome ?? "corretor";

      // Admins (cópia silenciosa)
      const adminIds = ((roles ?? []) as { user_id: string }[]).map((r) => r.user_id);
      let adminExt: string[] = [];
      if (adminIds.length) {
        const { data: adminProfs } = await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", adminIds);
        adminExt = ((adminProfs ?? []) as { onesignal_external_id: string | null }[])
          .map((p) => p.onesignal_external_id)
          .filter((x): x is string => !!x && x !== corretorExt);
      }

      const { sendOneSignalPush } = await import("@/lib/onesignal.server");

      // Push principal: para o corretor atribuído
      if (corretorExt) {
        const r = await sendOneSignalPush({
          externalId: corretorExt,
          title: "🏠 Novo Lead Atribuído!",
          message: `${lead.nome} · ${lead.telefone} · ${lead.regiao.replace(/_/g, " ")}`,
          url, data: { lead_id: data.lead_id },
        });
        console.info("[atribuirLead] push corretor", { ok: r.ok, error: r.error });
      } else {
        console.warn("[atribuirLead] corretor sem onesignal_external_id; push individual não enviado", { corretor_id: data.corretor_id });
      }

      // Cópia para admins
      if (adminExt.length) {
        const r = await sendOneSignalPush({
          externalIds: adminExt,
          title: "✅ Lead Atribuído",
          message: `Lead ${lead.nome} atribuído para ${corretorNome}`,
          url, data: { lead_id: data.lead_id },
        });
        console.info("[atribuirLead] push admins", { count: adminExt.length, ok: r.ok });
      }
    } catch (e) {
      console.warn("[atribuirLead] push falhou", e);
    }


    return { ok: true };
  });

export const aceitarLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vendas_leads")
      .update({ atribuicao_status: "aceito" } as never)
      .eq("id", data.lead_id)
      .eq("corretor_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recusarLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid(), motivo: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leadRow } = await supabaseAdmin
      .from("vendas_leads").select("corretor_id, recusas, atribuido_por").eq("id", data.lead_id).maybeSingle();
    if (!leadRow || (leadRow as { corretor_id: string | null }).corretor_id !== context.userId) {
      throw new Error("Lead não pertence a você");
    }
    const recusas = (((leadRow as { recusas: unknown }).recusas as string[] | undefined) ?? []).slice();
    if (!recusas.includes(context.userId)) recusas.push(context.userId);

    const { error } = await supabaseAdmin
      .from("vendas_leads")
      .update({
        corretor_id: null,
        atribuicao_status: null,
        atribuido_em: null,
        recusas,
      } as never)
      .eq("id", data.lead_id);
    if (error) throw new Error(error.message);

    // Notifica admin/executivo
    try {
      const { sendOneSignalPush } = await import("@/lib/onesignal.server");
      const exec = (leadRow as { atribuido_por: string | null }).atribuido_por;
      if (exec) {
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("onesignal_external_id, nome").eq("id", context.userId).maybeSingle();
        const { data: execProf } = await supabaseAdmin
          .from("profiles").select("onesignal_external_id").eq("id", exec).maybeSingle();
        if (execProf?.onesignal_external_id) {
          await sendOneSignalPush({
            externalId: execProf.onesignal_external_id,
            title: "↩️ Lead recusado",
            message: `${prof?.nome ?? "Corretor"} recusou um lead${data.motivo ? `: ${data.motivo}` : ""}`,
            url: "https://sistemanexus.app/vendas/leads",
            data: { lead_id: data.lead_id },
          });
        }
      }
    } catch (e) {
      console.warn("[recusarLead] push falhou", e);
    }

    return { ok: true };
  });
