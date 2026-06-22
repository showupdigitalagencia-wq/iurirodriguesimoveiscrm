import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TimelineCategoria =
  | "criacao"
  | "atribuicao"
  | "transferencia"
  | "etapa"
  | "agendamento"
  | "cancelamento"
  | "fechamento"
  | "admin";

export interface TimelineEvent {
  id: string;
  at: string; // ISO
  categoria: TimelineCategoria;
  titulo: string;
  descricao: string | null;
  responsavel: { id: string | null; nome: string | null };
  alvo: { id: string | null; nome: string | null } | null;
  payload: Record<string, unknown> | null;
}

export const getLeadTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Autorização: admin OR exec OR corretor dono do lead
    const [{ data: isAdmin }, { data: isExec }, { data: leadRaw }] = await Promise.all([
      (context.supabase as { rpc: (n: string, a: unknown) => Promise<{ data: boolean | null }> })
        .rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      (context.supabase as { rpc: (n: string) => Promise<{ data: boolean | null }> })
        .rpc("current_user_is_executivo"),
      supabaseAdmin.from("vendas_leads")
        .select("id, nome, created_at, corretor_id, created_by, origem, origem_detalhe, fechado_em, etapa, comissao, atribuido_em, atribuido_por")
        .eq("id", data.lead_id)
        .maybeSingle(),
    ]);
    const lead = leadRaw as {
      id: string; nome: string; created_at: string; corretor_id: string | null;
      created_by: string | null; origem: string | null; origem_detalhe: string | null;
      fechado_em: string | null; etapa: string; comissao: number | null;
      atribuido_em: string | null; atribuido_por: string | null;
    } | null;
    if (!lead) throw new Error("Lead não encontrado");
    const isOwner = lead.corretor_id === context.userId;
    if (!isAdmin && !isExec && !isOwner) throw new Error("Acesso negado");

    // Fontes em paralelo
    const [hist, plog, vis] = await Promise.all([
      supabaseAdmin.from("vendas_lead_historico" as never)
        .select("id, etapa_anterior, etapa_nova, criado_em, user_id")
        .eq("lead_id", data.lead_id).order("criado_em", { ascending: true }),
      supabaseAdmin.from("plantao_log" as never)
        .select("id, motivo, origem, detalhe, criado_em, corretor_id")
        .eq("lead_id", data.lead_id).order("criado_em", { ascending: true }),
      supabaseAdmin.from("vendas_visitas" as never)
        .select("id, endereco, data_inicio, status, comparecimento, created_at, updated_at, corretor_id, confirmada_em, confirmada_por")
        .eq("lead_id", data.lead_id).order("created_at", { ascending: true }),
    ]);

    const histRows = (hist.data ?? []) as { id: string; etapa_anterior: string | null; etapa_nova: string; criado_em: string; user_id: string | null }[];
    const plogRows = (plog.data ?? []) as { id: string; motivo: string; origem: string | null; detalhe: Record<string, unknown> | null; criado_em: string; corretor_id: string | null }[];
    const visRows = (vis.data ?? []) as { id: string; endereco: string; data_inicio: string; status: string; comparecimento: string | null; created_at: string; updated_at: string; corretor_id: string | null; confirmada_em: string | null; confirmada_por: string | null }[];

    // Resolve nomes (uma única query)
    const ids = new Set<string>();
    if (lead.created_by) ids.add(lead.created_by);
    if (lead.corretor_id) ids.add(lead.corretor_id);
    if (lead.atribuido_por) ids.add(lead.atribuido_por);
    histRows.forEach((h) => h.user_id && ids.add(h.user_id));
    plogRows.forEach((p) => {
      if (p.corretor_id) ids.add(p.corretor_id);
      const d = p.detalhe ?? {};
      const cands: Array<unknown> = [
        (d as { criado_por?: { id?: string } }).criado_por?.id,
        (d as { atribuido_a?: { id?: string } | null }).atribuido_a?.id,
        (d as { de?: { id?: string } }).de?.id,
        (d as { para?: { id?: string } }).para?.id,
        (d as { por?: { id?: string } }).por?.id,
      ];
      for (const x of cands) if (typeof x === "string") ids.add(x);
    });
    visRows.forEach((v) => {
      if (v.corretor_id) ids.add(v.corretor_id);
      if (v.confirmada_por) ids.add(v.confirmada_por);
    });

    const nomes = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", Array.from(ids));
      for (const p of (profs ?? []) as { id: string; nome: string | null }[]) nomes.set(p.id, p.nome ?? "");
    }
    const nome = (id: string | null | undefined): string | null => (id ? (nomes.get(id) ?? null) : null);

    const events: TimelineEvent[] = [];

    // 1) Criação do lead
    events.push({
      id: `created-${lead.id}`,
      at: lead.created_at,
      categoria: "criacao",
      titulo: "Lead criado",
      descricao: lead.origem
        ? `Origem: ${lead.origem.replace(/_/g, " ")}${lead.origem_detalhe ? ` · ${lead.origem_detalhe}` : ""}`
        : null,
      responsavel: { id: lead.created_by, nome: nome(lead.created_by) },
      alvo: null,
      payload: { origem: lead.origem, origem_detalhe: lead.origem_detalhe },
    });

    // 2) plantao_log → atribuições / transferências / admin
    for (const p of plogRows) {
      const det = (p.detalhe ?? {}) as {
        mensagem?: string; motivo?: string;
        criado_por?: { id: string; nome: string | null };
        atribuido_a?: { id: string; nome: string | null } | null;
        de?: { id: string; nome: string | null };
        para?: { id: string; nome: string | null };
        por?: { id: string; nome: string | null };
      };
      const isTransfer = det.motivo === "reatribuicao_manual" || (det.de && det.para);
      const isAdminManual = det.motivo === "admin_manual";
      const categoria: TimelineCategoria = isTransfer ? "transferencia" : isAdminManual ? "admin" : "atribuicao";
      const titulo = isTransfer
        ? "Lead transferido"
        : isAdminManual
          ? "Atribuição manual por administrador"
          : p.motivo === "sem_plantonista"
            ? "Sem plantonista no momento"
            : "Atribuído ao plantonista do dia";
      const responsavelId = det.por?.id ?? det.criado_por?.id ?? null;
      const alvoId = det.para?.id ?? det.atribuido_a?.id ?? p.corretor_id ?? null;
      events.push({
        id: `plog-${p.id}`,
        at: p.criado_em,
        categoria,
        titulo,
        descricao: det.mensagem ?? null,
        responsavel: { id: responsavelId, nome: responsavelId ? (det.por?.nome ?? det.criado_por?.nome ?? nome(responsavelId)) : null },
        alvo: alvoId ? { id: alvoId, nome: det.para?.nome ?? det.atribuido_a?.nome ?? nome(alvoId) } : null,
        payload: p.detalhe,
      });
    }

    // 3) vendas_lead_historico → mudanças de etapa
    for (const h of histRows) {
      events.push({
        id: `hist-${h.id}`,
        at: h.criado_em,
        categoria: "etapa",
        titulo: "Mudança de etapa",
        descricao: `${(h.etapa_anterior ?? "—").replace(/_/g, " ")} → ${h.etapa_nova.replace(/_/g, " ")}`,
        responsavel: { id: h.user_id, nome: nome(h.user_id) },
        alvo: null,
        payload: { etapa_anterior: h.etapa_anterior, etapa_nova: h.etapa_nova },
      });
    }

    // 4) vendas_visitas → agendamentos / cancelamentos / comparecimentos
    for (const v of visRows) {
      events.push({
        id: `vis-create-${v.id}`,
        at: v.created_at,
        categoria: "agendamento",
        titulo: "Visita agendada",
        descricao: `${v.endereco} · ${new Date(v.data_inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        responsavel: { id: v.corretor_id, nome: nome(v.corretor_id) },
        alvo: null,
        payload: { visita_id: v.id, data_inicio: v.data_inicio, endereco: v.endereco, status: v.status },
      });
      if (v.status === "cancelada") {
        events.push({
          id: `vis-cancel-${v.id}`,
          at: v.updated_at,
          categoria: "cancelamento",
          titulo: "Visita cancelada",
          descricao: v.endereco,
          responsavel: { id: v.corretor_id, nome: nome(v.corretor_id) },
          alvo: null,
          payload: { visita_id: v.id },
        });
      }
      if (v.comparecimento) {
        events.push({
          id: `vis-comp-${v.id}`,
          at: v.confirmada_em ?? v.updated_at,
          categoria: v.comparecimento === "realizada" ? "agendamento" : "cancelamento",
          titulo: v.comparecimento === "realizada" ? "Visita realizada" : "Cliente não compareceu",
          descricao: v.endereco,
          responsavel: { id: v.confirmada_por, nome: nome(v.confirmada_por) },
          alvo: null,
          payload: { visita_id: v.id, comparecimento: v.comparecimento },
        });
      }
    }

    // 5) Fechamento / perda (a partir do lead atual)
    if (lead.fechado_em && lead.etapa === "fechado") {
      events.push({
        id: `fechado-${lead.id}`,
        at: lead.fechado_em,
        categoria: "fechamento",
        titulo: "Lead fechado",
        descricao: lead.comissao != null ? `Comissão: R$ ${Number(lead.comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null,
        responsavel: { id: null, nome: null },
        alvo: null,
        payload: { comissao: lead.comissao },
      });
    }

    // Ordena cronologicamente (asc); cliente pode inverter se quiser
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return { events, lead: { id: lead.id, nome: lead.nome } };
  });
