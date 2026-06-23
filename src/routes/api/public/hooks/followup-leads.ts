import { createFileRoute } from "@tanstack/react-router";

// Cron diário. Varre leads ATIVOS (não fechados/perdidos/descartados) cujo
// `updated_at` está há mais de N dias (config `lead_followup_dias`, default 5)
// sem alteração. Envia push ao corretor responsável e marca
// `followup_alerta_em = now()` para não disparar novamente até que o lead
// receba uma nova interação (updated_at > followup_alerta_em).

type ConfigRow = { valor: unknown };
type LeadCap = {
  id: string;
  nome: string;
  telefone: string;
  updated_at: string;
  responsavel_id: string | null;
  followup_alerta_em: string | null;
};
type LeadVendas = {
  id: string;
  nome: string;
  telefone: string;
  updated_at: string;
  corretor_id: string | null;
  followup_alerta_em: string | null;
};

const ETAPAS_CAP_ATIVAS = [
  "novo_lead",
  "contato_realizado",
  "visita_agendada",
  "proposta_enviada",
  "solicitacao_documentos",
  "documentos_enviados",
  "em_negociacao",
  "follow_up",
];

const ETAPAS_VENDAS_ATIVAS = [
  "novo_lead",
  "contato_realizado",
  "visita_agendada",
  "proposta_enviada",
  "em_negociacao",
  "follow_up",
];

export const Route = createFileRoute("/api/public/hooks/followup-leads")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, info: "Alerta de follow-up esquecido (POST p/ rodar)" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const { data: cfg } = await supabaseAdmin
          .from("configuracoes")
          .select("valor")
          .eq("chave", "lead_followup_dias")
          .maybeSingle();
        const rawDias = (cfg as ConfigRow | null)?.valor;
        const dias = typeof rawDias === "number" ? rawDias
          : typeof rawDias === "string" ? Number(rawDias) || 5
          : 5;
        const cutoffIso = new Date(Date.now() - dias * 86400 * 1000).toISOString();

        // 1) Captação
        const { data: leadsCapRaw } = await supabaseAdmin
          .from("leads")
          .select("id, nome, telefone, updated_at, responsavel_id, followup_alerta_em")
          .in("etapa", ETAPAS_CAP_ATIVAS as never)
          .lte("updated_at", cutoffIso);
        const leadsCap = ((leadsCapRaw ?? []) as LeadCap[]).filter(
          (l) => !l.followup_alerta_em || l.followup_alerta_em < l.updated_at,
        );

        // 2) Vendas
        const { data: leadsVendasRaw } = await supabaseAdmin
          .from("vendas_leads")
          .select("id, nome, telefone, updated_at, corretor_id, followup_alerta_em")
          .in("etapa", ETAPAS_VENDAS_ATIVAS as never)
          .lte("updated_at", cutoffIso);
        const leadsVendas = ((leadsVendasRaw ?? []) as LeadVendas[]).filter(
          (l) => !l.followup_alerta_em || l.followup_alerta_em < l.updated_at,
        );

        // 3) Resolve external_ids
        const respIds = Array.from(new Set(leadsCap.map((l) => l.responsavel_id).filter(Boolean))) as string[];
        const profIds = Array.from(new Set(leadsVendas.map((l) => l.corretor_id).filter(Boolean))) as string[];

        const respMap = new Map<string, string | null>();
        if (respIds.length) {
          const { data } = await supabaseAdmin
            .from("responsaveis")
            .select("id, onesignal_external_id")
            .in("id", respIds);
          for (const r of (data ?? []) as { id: string; onesignal_external_id: string | null }[]) {
            respMap.set(r.id, r.onesignal_external_id);
          }
        }
        const profMap = new Map<string, string | null>();
        if (profIds.length) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, onesignal_external_id")
            .in("id", profIds);
          for (const p of (data ?? []) as { id: string; onesignal_external_id: string | null }[]) {
            profMap.set(p.id, p.onesignal_external_id);
          }
        }

        const agora = new Date().toISOString();
        let pushOk = 0, pushFail = 0, skipNoDest = 0;
        const erros: string[] = [];

        for (const lead of leadsCap) {
          const extId = lead.responsavel_id ? respMap.get(lead.responsavel_id) : null;
          const inativoDias = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
          if (extId) {
            const r = await sendOneSignalPush({
              externalId: extId,
              title: "Follow-up esquecido",
              message: `${lead.nome} está sem interação há ${inativoDias} dias. Retome o contato.`,
              data: { tipo: "followup_esquecido", lead_id: lead.id, fonte: "captacao" },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          } else {
            skipNoDest++;
          }
          await supabaseAdmin
            .from("leads")
            .update({ followup_alerta_em: agora } as never)
            .eq("id", lead.id);
        }

        for (const lead of leadsVendas) {
          const extId = lead.corretor_id ? profMap.get(lead.corretor_id) : null;
          const inativoDias = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
          if (extId) {
            const r = await sendOneSignalPush({
              externalId: extId,
              title: "Follow-up esquecido",
              message: `${lead.nome} está sem interação há ${inativoDias} dias. Retome o contato.`,
              data: { tipo: "followup_esquecido", lead_id: lead.id, fonte: "vendas" },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          } else {
            skipNoDest++;
          }
          await supabaseAdmin
            .from("vendas_leads")
            .update({ followup_alerta_em: agora } as never)
            .eq("id", lead.id);
        }

        return new Response(JSON.stringify({
          ok: true,
          dias,
          captacao: leadsCap.length,
          vendas: leadsVendas.length,
          push_ok: pushOk,
          push_fail: pushFail,
          skip_sem_destinatario: skipNoDest,
          erros: erros.slice(0, 5),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
