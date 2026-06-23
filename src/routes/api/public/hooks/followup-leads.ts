import { createFileRoute } from "@tanstack/react-router";

// Cron diário. Para cada etapa ATIVA das duas pipelines, lê o limite de dias
// configurado pelo Admin e varre leads cujo `updated_at` está há mais tempo
// que esse limite. Envia push e marca `followup_alerta_em = now()` para não
// repetir até que o lead receba nova interação (updated_at > followup_alerta_em).
//
// Captação: notifica o Executivo responsável pela região (regiao_responsavel).
// Vendas:   notifica o corretor/executivo responsável pelo lead.

type ConfigRow = { valor: unknown };

const DEFAULT_VENDAS: Record<string, number> = {
  novo_lead: 1,
  contato_realizado: 3,
  visita_agendada: 2,
  proposta_enviada: 4,
  em_negociacao: 5,
  follow_up: 3,
};

const DEFAULT_CAPTACAO: Record<string, number> = {
  novos_leads: 1,
  em_atendimento: 3,
  reuniao_agendada: 2,
  solicitacao_documentos: 5,
  documentos_enviados: 4,
  em_negociacao: 5,
  follow_up: 3,
};

function parseDiasMap(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const out: Record<string, number> = { ...fallback };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

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

        // 1) Configurações por etapa
        const { data: cfgRows } = await supabaseAdmin
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["lead_followup_dias_vendas", "lead_followup_dias_captacao"] as never);
        const cfgMap = new Map<string, unknown>();
        for (const r of (cfgRows ?? []) as Array<{ chave: string } & ConfigRow>) {
          cfgMap.set(r.chave, r.valor);
        }
        const diasVendas = parseDiasMap(cfgMap.get("lead_followup_dias_vendas"), DEFAULT_VENDAS);
        const diasCaptacao = parseDiasMap(cfgMap.get("lead_followup_dias_captacao"), DEFAULT_CAPTACAO);

        // 2) Mapas de responsáveis por região (para captação)
        const { data: regRows } = await supabaseAdmin
          .from("regiao_responsavel")
          .select("regiao, responsavel_id");
        const regiaoToResp = new Map<string, string>();
        for (const r of (regRows ?? []) as { regiao: string; responsavel_id: string }[]) {
          regiaoToResp.set(r.regiao, r.responsavel_id);
        }

        const agora = new Date().toISOString();
        let pushOk = 0, pushFail = 0, skipNoDest = 0;
        let totalCap = 0, totalVendas = 0;
        const erros: string[] = [];

        type LeadCap = {
          id: string; nome: string; updated_at: string;
          regiao: string; followup_alerta_em: string | null;
        };
        type LeadVendas = {
          id: string; nome: string; updated_at: string;
          corretor_id: string | null; followup_alerta_em: string | null;
        };

        // 3) Vendas — por etapa
        const profIdsNeeded = new Set<string>();
        const vendasPorEtapa: Array<{ etapa: string; leads: LeadVendas[] }> = [];
        for (const [etapa, dias] of Object.entries(diasVendas)) {
          const cutoff = new Date(Date.now() - dias * 86400000).toISOString();
          const { data } = await supabaseAdmin
            .from("vendas_leads")
            .select("id, nome, updated_at, corretor_id, followup_alerta_em")
            .eq("etapa", etapa as never)
            .lte("updated_at", cutoff);
          const leads = ((data ?? []) as LeadVendas[]).filter(
            (l) => !l.followup_alerta_em || l.followup_alerta_em < l.updated_at,
          );
          vendasPorEtapa.push({ etapa, leads });
          for (const l of leads) if (l.corretor_id) profIdsNeeded.add(l.corretor_id);
        }

        // 4) Captação — por etapa
        const respIdsNeeded = new Set<string>();
        const capPorEtapa: Array<{ etapa: string; leads: LeadCap[] }> = [];
        for (const [etapa, dias] of Object.entries(diasCaptacao)) {
          const cutoff = new Date(Date.now() - dias * 86400000).toISOString();
          const { data } = await supabaseAdmin
            .from("leads")
            .select("id, nome, updated_at, regiao, followup_alerta_em")
            .eq("etapa", etapa as never)
            .lte("updated_at", cutoff);
          const leads = ((data ?? []) as LeadCap[]).filter(
            (l) => !l.followup_alerta_em || l.followup_alerta_em < l.updated_at,
          );
          capPorEtapa.push({ etapa, leads });
          for (const l of leads) {
            const respId = regiaoToResp.get(l.regiao);
            if (respId) respIdsNeeded.add(respId);
          }
        }

        // 5) Resolve external_ids
        const profMap = new Map<string, string | null>();
        if (profIdsNeeded.size) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, onesignal_external_id")
            .in("id", Array.from(profIdsNeeded));
          for (const p of (data ?? []) as { id: string; onesignal_external_id: string | null }[]) {
            profMap.set(p.id, p.onesignal_external_id);
          }
        }
        const respMap = new Map<string, string | null>();
        if (respIdsNeeded.size) {
          const { data } = await supabaseAdmin
            .from("responsaveis")
            .select("id, onesignal_external_id")
            .in("id", Array.from(respIdsNeeded));
          for (const r of (data ?? []) as { id: string; onesignal_external_id: string | null }[]) {
            respMap.set(r.id, r.onesignal_external_id);
          }
        }

        // 6) Disparo Vendas
        for (const { leads } of vendasPorEtapa) {
          totalVendas += leads.length;
          for (const lead of leads) {
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
        }

        // 7) Disparo Captação
        for (const { leads } of capPorEtapa) {
          totalCap += leads.length;
          for (const lead of leads) {
            const respId = regiaoToResp.get(lead.regiao);
            const extId = respId ? respMap.get(respId) : null;
            const inativoDias = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
            if (extId) {
              const r = await sendOneSignalPush({
                externalId: extId,
                title: "Follow-up esquecido (Captação)",
                message: `${lead.nome} (${lead.regiao}) está sem interação há ${inativoDias} dias.`,
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
        }

        return new Response(JSON.stringify({
          ok: true,
          dias_vendas: diasVendas,
          dias_captacao: diasCaptacao,
          captacao: totalCap,
          vendas: totalVendas,
          push_ok: pushOk,
          push_fail: pushFail,
          skip_sem_destinatario: skipNoDest,
          erros: erros.slice(0, 5),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
