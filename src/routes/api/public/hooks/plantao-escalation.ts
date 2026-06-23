import { createFileRoute } from "@tanstack/react-router";

// Cron de 1 minuto. Escalona leads de plantão pendentes para o próximo da
// escala quando o plantonista não responde dentro do SLA:
//   - SLA padrão: 10 minutos (plantonista livre na hora da chegada)
//   - SLA reduzido: 3 minutos (plantonista estava em compromisso na chegada)
// Coexiste com o comando manual da Laura — só atua em leads cuja
// atribuição automática continua pendente e ainda não foi escalonada.

type LeadRow = {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  corretor_id: string | null;
  atribuido_em: string | null;
  plantao_dia: string | null;
  plantao_ocupado_no_atribuir: boolean | null;
  plantao_escalonado_em: string | null;
  plantao_proximo_id: string | null;
};

const SLA_LIVRE_MIN = 10;
const SLA_OCUPADO_MIN = 3;

export const Route = createFileRoute("/api/public/hooks/plantao-escalation")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Escalonamento de plantão (POST p/ rodar)" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const hoje = new Date().toISOString().slice(0, 10);
        const { data: rows } = await supabaseAdmin
          .from("vendas_leads" as never)
          .select("id, nome, telefone, origem, corretor_id, atribuido_em, plantao_dia, plantao_ocupado_no_atribuir, plantao_escalonado_em, plantao_proximo_id")
          .eq("plantao_dia", hoje)
          .eq("atribuicao_status", "pendente")
          .is("plantao_escalonado_em", null)
          .is("first_response_at", null)
          .not("corretor_id", "is", null)
          .not("atribuido_em", "is", null);
        const leads = (rows ?? []) as unknown as LeadRow[];

        if (!leads.length) {
          return new Response(JSON.stringify({ ok: true, processados: 0 }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const agora = Date.now();
        const elegiveis = leads.filter((l) => {
          if (!l.atribuido_em) return false;
          const idadeMin = (agora - new Date(l.atribuido_em).getTime()) / 60000;
          const sla = l.plantao_ocupado_no_atribuir ? SLA_OCUPADO_MIN : SLA_LIVRE_MIN;
          return idadeMin >= sla;
        });
        if (!elegiveis.length) {
          return new Response(JSON.stringify({ ok: true, processados: 0, analisados: leads.length }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        let escalonados = 0;
        const erros: string[] = [];

        for (const lead of elegiveis) {
          // Determina próximo: prioriza o que já foi pré-avisado; senão calcula agora.
          let proximoId = lead.plantao_proximo_id;
          if (!proximoId && lead.corretor_id) {
            const { data: prox } = await supabaseAdmin
              .from("plantao_escala" as never)
              .select("corretor_id, data")
              .gt("data", hoje)
              .neq("corretor_id", lead.corretor_id)
              .order("data", { ascending: true })
              .limit(1)
              .maybeSingle();
            proximoId = (prox as { corretor_id: string } | null)?.corretor_id ?? null;
          }
          if (!proximoId) {
            erros.push(`sem proximo para lead ${lead.id}`);
            continue;
          }

          const nowIso = new Date().toISOString();
          const { error: upErr } = await supabaseAdmin
            .from("vendas_leads")
            .update({
              corretor_id: proximoId,
              atribuicao_status: "pendente",
              atribuido_em: nowIso,
              plantao_escalonado_em: nowIso,
              plantao_ocupado_no_atribuir: false,
              plantao_proximo_id: null,
            } as never)
            .eq("id", lead.id)
            .eq("corretor_id", lead.corretor_id) // guarda otimista
            .eq("atribuicao_status", "pendente");
          if (upErr) { erros.push(upErr.message); continue; }

          await supabaseAdmin.from("plantao_log" as never).insert({
            lead_id: lead.id,
            corretor_id: proximoId,
            motivo: "redirecionamento_demora",
            origem: lead.origem as never,
            detalhe: {
              de: lead.corretor_id,
              para: proximoId,
              sla_min: lead.plantao_ocupado_no_atribuir ? SLA_OCUPADO_MIN : SLA_LIVRE_MIN,
              plantonista_status: lead.plantao_ocupado_no_atribuir ? "ocupado" : "livre",
            } as never,
          } as never);

          // Push para o novo dono.
          const { data: prof } = await supabaseAdmin
            .from("profiles").select("onesignal_external_id").eq("id", proximoId).maybeSingle();
          const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
          if (ext) {
            await sendOneSignalPush({
              externalId: ext,
              title: "🔁 Lead redirecionado pra você",
              message: `${lead.nome} · ${lead.telefone} — o plantonista não respondeu a tempo.`,
              url: "https://sistemanexus.app/vendas/leads",
              data: { lead_id: lead.id, tipo: "redirecionamento_demora" },
            });
          }
          escalonados++;
        }

        return new Response(JSON.stringify({
          ok: true, analisados: leads.length, escalonados, erros: erros.slice(0, 5),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
