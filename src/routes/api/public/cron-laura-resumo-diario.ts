import { createFileRoute } from "@tanstack/react-router";

// Roda 1x/dia às 8h Brasília (= 11:00 UTC).
// Envia push de resumo + alertas para cada líder (admin + executivos),
// e alerta o líder sobre queda de performance / inatividade na equipe.

type Profile = { id: string; nome: string; ativo: boolean; responsavel_id: string | null; onesignal_external_id: string | null };

export const Route = createFileRoute("/api/public/cron-laura-resumo-diario")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Laura daily summary cron" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        const agora = new Date();
        const h48 = new Date(agora.getTime() - 48 * 3600 * 1000).toISOString();
        const h72 = new Date(agora.getTime() - 72 * 3600 * 1000).toISOString();
        const inicioDia = new Date(agora); inicioDia.setUTCHours(0, 0, 0, 0);
        const fimDia = new Date(inicioDia.getTime() + 36 * 3600 * 1000);
        const ontemInicio = new Date(inicioDia.getTime() - 24 * 3600 * 1000);

        // 1) Carregar todos os corretores ativos + executivos + admins
        const { data: profilesRaw } = await supabaseAdmin
          .from("profiles")
          .select("id, nome, ativo, responsavel_id, onesignal_external_id");
        const profiles = (profilesRaw ?? []) as Profile[];
        const profilesById = new Map(profiles.map((p) => [p.id, p]));

        const { data: rolesRaw } = await supabaseAdmin.from("user_roles").select("user_id, role");
        const roles = (rolesRaw ?? []) as { user_id: string; role: string }[];
        const adminIds = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));

        const { data: respRaw } = await supabaseAdmin
          .from("responsaveis")
          .select("id, nome, regiao, onesignal_external_id, ativo")
          .eq("ativo", true);
        const executivos = (respRaw ?? []) as { id: string; nome: string; regiao: string | null; onesignal_external_id: string | null }[];

        // 2) Dados de leads, reuniões e atividade (uma vez, depois filtramos por equipe)
        const { data: leadsRaw } = await supabaseAdmin
          .from("vendas_leads")
          .select("id, nome, etapa, corretor_id, created_at, updated_at");
        const leads = (leadsRaw ?? []) as { id: string; nome: string; etapa: string; corretor_id: string | null; created_at: string; updated_at: string }[];

        const { data: reunioesRaw } = await supabaseAdmin
          .from("reunioes" as never)
          .select("id, titulo, data_inicio, status")
          .gte("data_inicio", inicioDia.toISOString())
          .lt("data_inicio", fimDia.toISOString());
        const reunioesHoje = (reunioesRaw ?? []) as unknown as { id: string; titulo: string; data_inicio: string; status: string }[];

        const { data: histRaw } = await supabaseAdmin
          .from("lead_historico")
          .select("user_id, created_at")
          .gte("created_at", h72);
        const ativos72h = new Set(((histRaw ?? []) as { user_id: string }[]).map((a) => a.user_id));

        const { data: histOntemRaw } = await supabaseAdmin
          .from("lead_historico")
          .select("user_id, acao, created_at")
          .gte("created_at", ontemInicio.toISOString())
          .lt("created_at", inicioDia.toISOString());
        const histOntem = (histOntemRaw ?? []) as { user_id: string; acao: string }[];
        const fechadosOntemPorUser = new Map<string, number>();
        const contatosOntemPorUser = new Map<string, number>();
        histOntem.forEach((h) => {
          if (h.acao === "contratado_corretor" || h.acao === "lead_fechado") {
            fechadosOntemPorUser.set(h.user_id, (fechadosOntemPorUser.get(h.user_id) ?? 0) + 1);
          }
          if (h.acao?.startsWith("contato") || h.acao === "novo_contato") {
            contatosOntemPorUser.set(h.user_id, (contatosOntemPorUser.get(h.user_id) ?? 0) + 1);
          }
        });

        // 3) Para cada líder (admin + executivo), montar pacote e enviar
        const results: unknown[] = [];

        async function enviarParaLider(opts: {
          externalId: string | null;
          nomeLider: string;
          escopo: "admin" | "executivo";
          equipeIds: string[]; // corretores que esse líder gerencia
        }) {
          if (!opts.externalId) return;

          const equipeSet = new Set(opts.equipeIds);
          const leadsEquipe = leads.filter((l) => l.corretor_id && equipeSet.has(l.corretor_id));
          const ativos = leadsEquipe.filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido");
          const parados = leadsEquipe.filter(
            (l) => ["novo", "contato", "qualificado"].includes(l.etapa) && l.updated_at < h48,
          );
          const fechadosOntem = opts.equipeIds.reduce((acc, id) => acc + (fechadosOntemPorUser.get(id) ?? 0), 0);
          const inativos: string[] = [];
          const contatosZero: string[] = [];
          opts.equipeIds.forEach((id) => {
            const p = profilesById.get(id);
            if (!p || !p.ativo) return;
            if (!ativos72h.has(id)) inativos.push(p.nome);
            const c = contatosOntemPorUser.get(id) ?? 0;
            if (c === 0 && (fechadosOntemPorUser.get(id) ?? 0) === 0) contatosZero.push(p.nome);
          });

          // melhor performer ontem
          let topNome: string | null = null;
          let topQtd = 0;
          opts.equipeIds.forEach((id) => {
            const q = (fechadosOntemPorUser.get(id) ?? 0) + (contatosOntemPorUser.get(id) ?? 0);
            if (q > topQtd) {
              topQtd = q;
              topNome = profilesById.get(id)?.nome ?? null;
            }
          });

          const linhas: string[] = [];
          linhas.push(`📊 ${ativos.length} leads ativos`);
          if (fechadosOntem) linhas.push(`✅ ${fechadosOntem} fechado(s) ontem`);
          if (parados.length) linhas.push(`⚠️ ${parados.length} parado(s) +48h`);
          if (inativos.length) linhas.push(`💤 Sem atividade 72h: ${inativos.slice(0, 3).join(", ")}${inativos.length > 3 ? ` +${inativos.length - 3}` : ""}`);
          if (reunioesHoje.length) linhas.push(`📅 ${reunioesHoje.length} reunião(ões) hoje`);
          if (topNome && topQtd > 0) linhas.push(`🏆 Destaque ontem: ${topNome}`);

          const title = `☀️ Bom dia, ${opts.nomeLider.split(/\s+/)[0]}!`;
          const message = linhas.length ? linhas.join(" • ") : "Tudo tranquilo hoje. Bom trabalho!";
          const url = "https://iurirodriguesimoveiscrm.lovable.app/?laura=1";

          const res = await sendOneSignalPush({
            externalIds: [opts.externalId],
            title,
            message,
            url,
            data: { tipo: "laura_resumo_diario", escopo: opts.escopo },
          });
          results.push({ lider: opts.nomeLider, escopo: opts.escopo, alertas: linhas.length, ok: res.ok, error: res.error });
        }

        // Admin: equipe = TODOS corretores ativos
        const todosCorretoresIds = profiles.filter((p) => p.ativo).map((p) => p.id);
        for (const adminId of adminIds) {
          const adminProfile = profilesById.get(adminId);
          await enviarParaLider({
            externalId: adminProfile?.onesignal_external_id ?? null,
            nomeLider: adminProfile?.nome ?? "Admin",
            escopo: "admin",
            equipeIds: todosCorretoresIds,
          });
        }

        // Executivos: equipe = profiles.responsavel_id = exec.id
        for (const exec of executivos) {
          const equipeIds = profiles.filter((p) => p.responsavel_id === exec.id).map((p) => p.id);
          if (!equipeIds.length) continue;
          await enviarParaLider({
            externalId: exec.onesignal_external_id,
            nomeLider: exec.nome,
            escopo: "executivo",
            equipeIds,
          });
        }

        return new Response(JSON.stringify({ ok: true, enviados: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
