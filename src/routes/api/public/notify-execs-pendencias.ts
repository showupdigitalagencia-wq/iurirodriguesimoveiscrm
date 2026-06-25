import { createFileRoute } from "@tanstack/react-router";
import { sendOneSignalPush } from "@/lib/onesignal.server";

// Endpoint público: dispara notificação push para cada Executivo
// resumindo pendências de Captação + Vendas (mesma fonte da Central "Hoje").
// Uso:
//   POST https://sistemanexus.app/api/public/notify-execs-pendencias
//   body opcional: { "nomes": ["Robson","Fabiola","Renata","Denise"], "dryRun": false }

type ExecRow = {
  resp_id: string;
  nome: string;
  external_id: string | null;
  user_id: string | null;
};

function todayISOStart() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function todayISOEnd() { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

export const Route = createFileRoute("/api/public/notify-execs-pendencias")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let input: { nomes?: string[]; dryRun?: boolean } = {};
        try { input = await request.json(); } catch { /* sem body */ }
        const nomes = input.nomes && input.nomes.length
          ? input.nomes
          : ["Robson", "Fabiola", "Renata", "Denise"];
        const dryRun = input.dryRun === true;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Localiza os executivos por nome
        const { data: respRows } = await supabaseAdmin
          .from("responsaveis")
          .select("id, nome, onesignal_external_id")
          .or(nomes.map((n) => `nome.ilike.%${n}%`).join(","));

        const execs: ExecRow[] = [];
        for (const r of (respRows ?? []) as Array<{ id: string; nome: string; onesignal_external_id: string | null }>) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("id, onesignal_external_id")
            .eq("responsavel_id", r.id)
            .maybeSingle();
          execs.push({
            resp_id: r.id,
            nome: r.nome,
            external_id: r.onesignal_external_id ?? prof?.onesignal_external_id ?? null,
            user_id: prof?.id ?? null,
          });
        }

        // Config: dias de candidatos sem contato + horas para chave atrasada
        const { data: cfgCand } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "candidatos_sem_contato_dias").maybeSingle();
        const { data: cfgChaves } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", "chaves_atraso_horas").maybeSingle();
        const diasCand = typeof cfgCand?.valor === "number" ? cfgCand.valor : 3;
        const horasChaves = typeof cfgChaves?.valor === "number" ? cfgChaves.valor : 24;
        const limiteCand = new Date(Date.now() - diasCand * 86400_000).toISOString();
        const limiteChave = new Date(Date.now() - horasChaves * 3600_000).toISOString();

        const start = todayISOStart();
        const end = todayISOEnd();
        const results: Array<Record<string, unknown>> = [];

        for (const exec of execs) {
          // Corretores do time
          const { data: team } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("responsavel_id", exec.resp_id);
          const teamIds = ((team ?? []) as Array<{ id: string }>).map((t) => t.id);

          // ===== Captação =====
          const candPromise = supabaseAdmin
            .from("candidatos")
            .select("id", { count: "exact", head: true })
            .eq("responsavel_id", exec.resp_id)
            .eq("status", "pendente_revisao")
            .lt("created_at", limiteCand);

          const reunPromise = exec.user_id
            ? supabaseAdmin
                .from("reunioes")
                .select("id", { count: "exact", head: true })
                .eq("tipo", "institucional")
                .neq("status", "cancelada")
                .eq("criado_por", exec.user_id)
                .gte("data_inicio", start)
                .lte("data_inicio", end)
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          // ===== Vendas (time) =====
          const leadsUrgPromise = teamIds.length
            ? supabaseAdmin
                .from("vendas_leads")
                .select("id", { count: "exact", head: true })
                .in("corretor_id", teamIds)
                .eq("atribuicao_status", "aceito")
                .is("first_response_at", null)
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          const visitasPromise = teamIds.length
            ? supabaseAdmin
                .from("vendas_visitas")
                .select("id", { count: "exact", head: true })
                .in("corretor_id", teamIds)
                .gte("data_inicio", start)
                .lte("data_inicio", end)
                .neq("status", "cancelada")
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          const fupVPromise = teamIds.length
            ? supabaseAdmin
                .from("vendas_leads")
                .select("id", { count: "exact", head: true })
                .in("corretor_id", teamIds)
                .gte("followup_alerta_em", start)
                .lte("followup_alerta_em", end)
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          const fupCPromise = teamIds.length
            ? supabaseAdmin
                .from("leads")
                .select("id", { count: "exact", head: true })
                .in("responsavel_id", teamIds)
                .gte("followup_alerta_em", start)
                .lte("followup_alerta_em", end)
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          const chavesPromise = teamIds.length
            ? supabaseAdmin
                .from("imoveis")
                .select("id", { count: "exact", head: true })
                .in("chave_com_id", teamIds)
                .not("chave_retirada_em", "is", null)
                .lt("chave_retirada_em", limiteChave)
            : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null });

          const [cand, reun, leadsUrg, vis, fupV, fupC, ch] = await Promise.all([
            candPromise, reunPromise, leadsUrgPromise, visitasPromise, fupVPromise, fupCPromise, chavesPromise,
          ]);

          const captacao = (cand.count ?? 0) + (reun.count ?? 0);
          const vendas = (leadsUrg.count ?? 0) + (vis.count ?? 0) + (fupV.count ?? 0) + (fupC.count ?? 0) + (ch.count ?? 0);
          const total = captacao + vendas;

          const detalhe = {
            captacao: { candidatos_sem_contato: cand.count ?? 0, reunioes_institucionais_hoje: reun.count ?? 0 },
            vendas: {
              leads_urgentes: leadsUrg.count ?? 0,
              visitas_hoje: vis.count ?? 0,
              followups_hoje: (fupV.count ?? 0) + (fupC.count ?? 0),
              chaves_atrasadas: ch.count ?? 0,
            },
            total,
          };

          if (total === 0) {
            results.push({ exec: exec.nome, skipped: "sem pendências", detalhe });
            continue;
          }

          if (!exec.external_id) {
            results.push({ exec: exec.nome, skipped: "sem onesignal_external_id", detalhe });
            continue;
          }

          const title = "📋 Suas pendências de hoje";
          const message = `Você tem ${captacao} pendência${captacao === 1 ? "" : "s"} em Captação e ${vendas} em Vendas. Toque para ver em Hoje.`;

          if (dryRun) {
            results.push({ exec: exec.nome, dryRun: true, title, message, detalhe, external_id: exec.external_id });
            continue;
          }

          const push = await sendOneSignalPush({
            externalId: exec.external_id,
            title,
            message,
            url: "https://sistemanexus.app/hoje",
            data: { route: "/hoje", source: "pendencias_manual" },
          });
          results.push({ exec: exec.nome, sent: push.ok, error: push.error, detalhe });
        }

        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
