import { createFileRoute } from "@tanstack/react-router";

// Cron diário (9h Brasília). Varre leads marcados como perdidos/descartados
// há mais de N dias (config `lead_reativacao_dias`, default 60), envia push
// ao corretor/responsável e marca `reativacao_sugerida_em = now()` para não
// repetir. Nenhuma RLS é alterada — usa supabaseAdmin.

type ConfigRow = { valor: unknown };
type LeadCap = { id: string; nome: string; telefone: string; updated_at: string; responsavel_id: string | null };
type LeadVendas = { id: string; nome: string; telefone: string; updated_at: string; corretor_id: string | null };

export const Route = createFileRoute("/api/public/hooks/reativacao-leads-perdidos")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Reativação de leads perdidos (POST p/ rodar)" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        // 1) Lê configuração de dias
        const { data: cfg } = await supabaseAdmin
          .from("configuracoes")
          .select("valor")
          .eq("chave", "lead_reativacao_dias")
          .maybeSingle();
        const rawDias = (cfg as ConfigRow | null)?.valor;
        const dias = typeof rawDias === "number" ? rawDias
          : typeof rawDias === "string" ? Number(rawDias) || 60
          : 60;
        const cutoffIso = new Date(Date.now() - dias * 86400 * 1000).toISOString();

        // 2) Captação (leads.etapa = 'descartado')
        // Usa lead_historico para encontrar quando foi descartado; fallback para updated_at.
        const { data: leadsCapRaw } = await supabaseAdmin
          .from("leads")
          .select("id, nome, telefone, updated_at, responsavel_id")
          .eq("etapa", "descartado" as never)
          .is("reativacao_sugerida_em", null);
        const leadsCap = (leadsCapRaw ?? []) as LeadCap[];

        // Para cada um, busca a data real de descarte no histórico
        const capParaReativar: { lead: LeadCap; descartadoEm: string }[] = [];
        for (const l of leadsCap) {
          const { data: histRows } = await supabaseAdmin
            .from("lead_historico")
            .select("created_at, detalhe")
            .eq("lead_id", l.id)
            .eq("acao", "mudou_etapa")
            .order("created_at", { ascending: false })
            .limit(20);
          const descartoHist = (histRows ?? []).find((r) => {
            const det = r.detalhe as Record<string, unknown> | null;
            return det && (det.etapa === "descartado" || det.etapa === "perdido");
          });
          const dataReferencia = (descartoHist?.created_at as string | undefined) ?? l.updated_at;
          if (dataReferencia <= cutoffIso) {
            capParaReativar.push({ lead: l, descartadoEm: dataReferencia });
          }
        }

        // 3) Vendas (vendas_leads.etapa = 'perdido')
        const { data: leadsVendasRaw } = await supabaseAdmin
          .from("vendas_leads")
          .select("id, nome, telefone, updated_at, corretor_id")
          .eq("etapa", "perdido" as never)
          .is("reativacao_sugerida_em", null)
          .lte("updated_at", cutoffIso);
        const leadsVendas = (leadsVendasRaw ?? []) as LeadVendas[];

        // 4) Carrega responsáveis/profiles para descobrir external_id
        const respIds = Array.from(new Set(capParaReativar.map((x) => x.lead.responsavel_id).filter(Boolean))) as string[];
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

        // 5) Dispara pushes e marca reativacao_sugerida_em
        const agora = new Date().toISOString();
        let pushOk = 0, pushFail = 0, skipNoDest = 0;
        const erros: string[] = [];

        for (const { lead, descartadoEm } of capParaReativar) {
          const extId = lead.responsavel_id ? respMap.get(lead.responsavel_id) : null;
          if (extId) {
            const r = await sendOneSignalPush({
              externalId: extId,
              title: "Reativar lead?",
              message: `${lead.nome} (${lead.telefone}) está perdido há ${Math.floor((Date.now() - new Date(descartadoEm).getTime()) / 86400000)} dias.`,
              data: { tipo: "reativacao_lead", lead_id: lead.id, fonte: "captacao" },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          } else {
            skipNoDest++;
          }
          await supabaseAdmin
            .from("leads")
            .update({ reativacao_sugerida_em: agora } as never)
            .eq("id", lead.id);
        }

        for (const lead of leadsVendas) {
          const extId = lead.corretor_id ? profMap.get(lead.corretor_id) : null;
          if (extId) {
            const r = await sendOneSignalPush({
              externalId: extId,
              title: "Reativar lead?",
              message: `${lead.nome} (${lead.telefone}) está perdido há ${Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)} dias.`,
              data: { tipo: "reativacao_lead", lead_id: lead.id, fonte: "vendas" },
            });
            if (r.ok) pushOk++; else { pushFail++; if (r.error) erros.push(r.error); }
          } else {
            skipNoDest++;
          }
          await supabaseAdmin
            .from("vendas_leads")
            .update({ reativacao_sugerida_em: agora } as never)
            .eq("id", lead.id);
        }

        return new Response(JSON.stringify({
          ok: true,
          dias,
          captacao: capParaReativar.length,
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
