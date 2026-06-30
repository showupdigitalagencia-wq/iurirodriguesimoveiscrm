import { createFileRoute } from "@tanstack/react-router";
import { sendOneSignalPush } from "@/lib/onesignal.server";

// Endpoint público: envia push diário/sob demanda com as pendências da
// Central "Hoje" para Executivos, Corretores e perfil Administrativo.
// Modos:
//   - "morning"  → "☀️ Bom dia! Você tem N itens..."
//   - "evening"  → "🌙 Ainda restam N pendências..."
//   - "manual"   → versão neutra (pra disparo sob demanda)
// Regra: TODOS recebem (quem está zerado recebe mensagem positiva "em dia").
// POST https://sistemanexus.app/api/public/notify-execs-pendencias
// body opcional: { mode?: "manual"|"morning"|"evening", dryRun?: bool, uids?: string[] }

type Recipient = {
  uid: string;
  nome: string;
  external_id: string;
  resp_id: string | null; // não-nulo => Executivo
  isAdministrativo: boolean;
};

function startOfDayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function endOfDayISO() { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

export const Route = createFileRoute("/api/public/notify-execs-pendencias")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let input: { dryRun?: boolean; mode?: "manual" | "morning" | "evening"; uids?: string[] } = {};
        try { input = await request.json(); } catch { /* sem body */ }
        const dryRun = input.dryRun === true;
        const mode = input.mode ?? "manual";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // ===== 1) Monta lista de destinatários =====
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, nome, onesignal_external_id")
          .not("onesignal_external_id", "is", null);

        let profiles = ((profs ?? []) as Array<{ id: string; nome: string | null; onesignal_external_id: string | null }>)
          .filter((p) => !!p.onesignal_external_id);
        if (input.uids?.length) profiles = profiles.filter((p) => input.uids!.includes(p.id));

        if (!profiles.length) {
          return new Response(JSON.stringify({ ok: true, results: [], note: "sem destinatários" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const uids = profiles.map((p) => p.id);
        const [respExec, rolesAdm] = await Promise.all([
          supabaseAdmin.from("responsaveis").select("id, user_id").in("user_id", uids).eq("ativo", true),
          supabaseAdmin.from("user_roles").select("user_id").in("user_id", uids).eq("role", "administrativo"),
        ]);
        const execByUid = new Map<string, string>();
        ((respExec.data ?? []) as Array<{ id: string; user_id: string }>)
          .forEach((r) => execByUid.set(r.user_id, r.id));
        const admUids = new Set(((rolesAdm.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));

        const recipients: Recipient[] = profiles.map((p) => ({
          uid: p.id,
          nome: p.nome ?? "Usuário",
          external_id: p.onesignal_external_id as string,
          resp_id: execByUid.get(p.id) ?? null,
          isAdministrativo: admUids.has(p.id),
        }));

        // ===== 2) Config (mesmos thresholds da Central Hoje) =====
        const [cfgCand, cfgChaves] = await Promise.all([
          supabaseAdmin.from("configuracoes").select("valor").eq("chave", "candidatos_sem_contato_dias").maybeSingle(),
          supabaseAdmin.from("configuracoes").select("valor").eq("chave", "chaves_atraso_horas").maybeSingle(),
        ]);
        const diasCand = typeof cfgCand.data?.valor === "number" ? cfgCand.data.valor : 3;
        const horasChaves = typeof cfgChaves.data?.valor === "number" ? cfgChaves.data.valor : 24;
        const limiteCand = new Date(Date.now() - diasCand * 86400_000).toISOString();
        const limiteChave = new Date(Date.now() - horasChaves * 3600_000).toISOString();
        const start = startOfDayISO();
        const end = endOfDayISO();

        // Para admin: data_fim de contratos vencendo nos próximos 90 dias
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        const isoDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const hojeIso = isoDate(hoje);
        const limite90Iso = isoDate(new Date(hoje.getTime() + 90 * 86400_000));
        const fimMesIso = isoDate(fimMes);

        // ===== 3) Para cada destinatário, calcula pendências =====
        const results: Array<Record<string, unknown>> = [];

        for (const r of recipients) {
          // -- Vendas pessoais (todo perfil que opera) --
          const [leadsUrg, visitas, fupV, chaves] = await Promise.all([
            supabaseAdmin.from("vendas_leads")
              .select("id", { count: "exact", head: true })
              .eq("corretor_id", r.uid).eq("atribuicao_status", "aceito").is("first_response_at", null),
            supabaseAdmin.from("vendas_visitas")
              .select("id", { count: "exact", head: true })
              .eq("corretor_id", r.uid).gte("data_inicio", start).lte("data_inicio", end).neq("status", "cancelada"),
            supabaseAdmin.from("vendas_leads")
              .select("id", { count: "exact", head: true })
              .eq("corretor_id", r.uid).gte("followup_alerta_em", start).lte("followup_alerta_em", end),
            supabaseAdmin.from("imoveis")
              .select("id", { count: "exact", head: true })
              .eq("chave_com_id", r.uid).not("chave_retirada_em", "is", null).lt("chave_retirada_em", limiteChave),
          ]);
          // Captação: leads são vinculados via responsavel_id (responsaveis.id),
          // por isso só faz sentido para o Executivo da região.
          const fupC = r.resp_id
            ? await supabaseAdmin.from("leads")
                .select("id", { count: "exact", head: true })
                .eq("responsavel_id", r.resp_id)
                .gte("followup_alerta_em", start).lte("followup_alerta_em", end)
            : { count: 0 };


          // -- Captação (só Executivo) --
          let candidatosCount = 0, reunioesCount = 0;
          if (r.resp_id) {
            const [cand, reun] = await Promise.all([
              supabaseAdmin.from("candidatos")
                .select("id", { count: "exact", head: true })
                .eq("responsavel_id", r.resp_id).eq("status", "pendente_revisao").lt("created_at", limiteCand),
              supabaseAdmin.from("reunioes")
                .select("id", { count: "exact", head: true })
                .eq("tipo", "institucional").neq("status", "cancelada")
                .eq("criado_por", r.uid).gte("data_inicio", start).lte("data_inicio", end),
            ]);
            candidatosCount = cand.count ?? 0;
            reunioesCount = reun.count ?? 0;
          }

          // -- Administrativo (só Larissa / role administrativo) --
          let contratosCount = 0, pagamentosCount = 0, candAdmCount = 0, chavesAdmCount = 0;
          if (r.isAdministrativo) {
            const [contratos, pagamentos, candAdm, chavesAdm] = await Promise.all([
              supabaseAdmin.from("contratos")
                .select("id", { count: "exact", head: true })
                .gte("data_fim", hojeIso).lte("data_fim", limite90Iso)
                .not("status", "in", "(encerrado,cancelado)"),
              supabaseAdmin.from("pagamentos")
                .select("id", { count: "exact", head: true })
                .in("status", ["pendente", "atrasado"]).lte("mes_referencia", fimMesIso),
              supabaseAdmin.from("candidatos")
                .select("id", { count: "exact", head: true })
                .eq("status", "pendente_revisao"),
              supabaseAdmin.from("imoveis")
                .select("id", { count: "exact", head: true })
                .not("chave_retirada_em", "is", null).lt("chave_retirada_em", limiteChave),
            ]);
            contratosCount = contratos.count ?? 0;
            pagamentosCount = pagamentos.count ?? 0;
            candAdmCount = candAdm.count ?? 0;
            chavesAdmCount = chavesAdm.count ?? 0;
          }

          const captacao = candidatosCount + reunioesCount;
          const vendas = (leadsUrg.count ?? 0) + (visitas.count ?? 0)
            + (fupV.count ?? 0) + (fupC.count ?? 0) + (chaves.count ?? 0);
          const admin = contratosCount + pagamentosCount + candAdmCount + chavesAdmCount;
          const total = captacao + vendas + admin;

          const detalhe = {
            captacao: { candidatos_sem_contato: candidatosCount, reunioes_institucionais_hoje: reunioesCount },
            vendas: {
              leads_urgentes: leadsUrg.count ?? 0,
              visitas_hoje: visitas.count ?? 0,
              followups_hoje: (fupV.count ?? 0) + (fupC.count ?? 0),
              chaves_atrasadas: chaves.count ?? 0,
            },
            admin: {
              contratos_vencendo_90d: contratosCount,
              pagamentos_pendentes: pagamentosCount,
              candidatos_pendentes: candAdmCount,
              chaves_atrasadas: chavesAdmCount,
            },
            total,
          };

          // Monta a mensagem por modo (todos recebem, mesmo zerados)
          const partes: string[] = [];
          if (captacao) partes.push(`${captacao} em Captação`);
          if (vendas) partes.push(`${vendas} em Vendas`);
          if (admin) partes.push(`${admin} no Administrativo`);
          const resumo = partes.join(", ");

          let title: string;
          let message: string;
          if (total === 0) {
            if (mode === "morning") {
              title = "☀️ Bom dia!";
              message = "✅ Você está em dia — sem pendências hoje. Bom trabalho!";
            } else if (mode === "evening") {
              title = "🌙 Dia tranquilo";
              message = "✅ Você está em dia — sem pendências pendentes. Boa noite!";
            } else {
              title = "📋 Tudo certo";
              message = "✅ Você está em dia — sem pendências hoje.";
            }
          } else if (mode === "morning") {
            title = "☀️ Bom dia! Resumo de hoje";
            message = `Você tem ${total} ${total === 1 ? "item" : "itens"} pra hoje: ${resumo}. Toque para ver.`;
          } else if (mode === "evening") {
            title = "🌙 Ainda restam pendências";
            message = `Ainda restam ${total} ${total === 1 ? "pendência" : "pendências"} hoje: ${resumo}. Dá tempo de resolver!`;
          } else {
            title = "📋 Suas pendências";
            message = `Você tem ${total} ${total === 1 ? "item" : "itens"}: ${resumo}. Toque para abrir a Central Hoje.`;
          }


          if (dryRun) {
            results.push({ user: r.nome, dryRun: true, title, message, detalhe, external_id: r.external_id });
            continue;
          }

          const push = await sendOneSignalPush({
            externalId: r.external_id,
            title,
            message,
            url: "https://sistemanexus.app/hoje",
            data: { route: "/hoje", source: `pendencias_${mode}` },
          });
          results.push({ user: r.nome, sent: push.ok, error: push.error, detalhe });
        }

        return new Response(JSON.stringify({ ok: true, mode, results }, null, 2), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
