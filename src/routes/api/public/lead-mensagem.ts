import { createFileRoute } from "@tanstack/react-router";
import { normalizeOrigem, shouldUsePlantao } from "@/lib/plantao-shared";

// Webhook de reincidência: recebe nova mensagem de um lead já existente
// e (1) atualiza ultima_mensagem_em, (2) reatribui ao plantonista do dia
// se o plantonista mudou. Se o lead não existe ainda, cria pelo fluxo
// normal de plantão. Apenas leads canalizados pelo plantão (não Facebook+região fixa).
//
// Payload: { telefone: string, origem?: string, nome?: string, mensagem?: string, origem_detalhe?: string }

export const Route = createFileRoute("/api/public/lead-mensagem")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true, endpoint: "lead-mensagem" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),

      POST: async ({ request }) => {
        let raw: unknown;
        try { raw = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const telefone = String(body.telefone ?? "").replace(/\D/g, "");
        if (!telefone) {
          return new Response(JSON.stringify({ error: "telefone obrigatório" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const origem = normalizeOrigem((body.origem as string | undefined) ?? "outro");
        const nome = String(body.nome ?? "Sem nome");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // plantonista do dia (UTC date – simples)
        const hoje = new Date().toISOString().slice(0, 10);
        const { data: escala } = await supabaseAdmin
          .from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
        const plantonista = (escala as { corretor_id: string } | null)?.corretor_id ?? null;

        // procura lead existente por telefone
        const { data: existing } = await supabaseAdmin
          .from("vendas_leads")
          .select("id, corretor_id, atribuicao_status")
          .eq("telefone", telefone)
          .order("created_at" as never, { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const cur = existing as { id: string; corretor_id: string | null; atribuicao_status: string | null };
          const updates: Record<string, unknown> = { ultima_mensagem_em: new Date().toISOString() };
          let motivo: "reincidencia" | null = null;
          if (plantonista && plantonista !== cur.corretor_id) {
            updates.corretor_id = plantonista;
            updates.atribuicao_status = "pendente";
            updates.atribuido_em = new Date().toISOString();
            updates.plantao_dia = hoje;
            motivo = "reincidencia";
          }
          await supabaseAdmin.from("vendas_leads").update(updates as never).eq("id", cur.id);
          await supabaseAdmin.from("plantao_log" as never).insert({
            lead_id: cur.id, corretor_id: plantonista, motivo: motivo ?? "novo_lead",
            origem, detalhe: { telefone, anterior: cur.corretor_id } as never,
          } as never);

          if (motivo === "reincidencia" && plantonista) {
            await notifyPlantonista({ supabaseAdmin, corretorId: plantonista, leadId: cur.id, nome, telefone, origem, isReassign: true });
          }
          return new Response(JSON.stringify({ ok: true, id: cur.id, reassigned: motivo === "reincidencia" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        // Lead novo — só cria se cair na lógica de plantão
        if (!shouldUsePlantao(origem, "outras")) {
          return new Response(JSON.stringify({ error: "use o webhook principal para este canal" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
        const insert = {
          nome, telefone, etapa: "novo_lead",
          origem, origem_detalhe: (body.origem_detalhe as string | null) ?? null,
          ultima_mensagem_em: new Date().toISOString(),
          plantao_dia: hoje,
          corretor_id: plantonista,
          atribuicao_status: plantonista ? "pendente" : null,
          atribuido_em: plantonista ? new Date().toISOString() : null,
        } as never;
        const { data: novo, error } = await supabaseAdmin.from("vendas_leads").insert(insert).select("id").single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        await supabaseAdmin.from("plantao_log" as never).insert({
          lead_id: novo.id, corretor_id: plantonista,
          motivo: plantonista ? "novo_lead" : "sem_plantonista",
          origem, detalhe: { telefone } as never,
        } as never);
        if (plantonista) {
          await notifyPlantonista({ supabaseAdmin, corretorId: plantonista, leadId: novo.id, nome, telefone, origem, isReassign: false });
        } else {
          await notifyAdmins({ supabaseAdmin, leadId: novo.id, nome, telefone, origem });
        }
        return new Response(JSON.stringify({ ok: true, id: novo.id, plantonista }), {
          status: 201, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

async function notifyPlantonista(args: { supabaseAdmin: any; corretorId: string; leadId: string; nome: string; telefone: string; origem: string; isReassign: boolean }) {
  try {
    const { data: prof } = await args.supabaseAdmin
      .from("profiles").select("onesignal_external_id").eq("id", args.corretorId).maybeSingle();
    const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
    if (!ext) return;
    const { sendOneSignalPush } = await import("@/lib/onesignal.server");
    await sendOneSignalPush({
      externalId: ext,
      title: args.isReassign ? "🔁 Lead reatribuído" : "🏠 Novo lead de plantão",
      message: `${args.nome} · ${args.telefone} · ${args.origem.replace(/_/g, " ")}`,
      url: "https://sistemanexus.app/vendas/leads",
      data: { lead_id: args.leadId },
    });
  } catch (e) { console.warn("[lead-mensagem] push falhou", e); }
}

async function notifyAdmins(args: { supabaseAdmin: any; leadId: string; nome: string; telefone: string; origem: string }) {
  try {
    const { data: roles } = await args.supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = ((roles ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (!ids.length) return;
    const { data: profs } = await args.supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", ids);
    const ext = ((profs ?? []) as { onesignal_external_id: string | null }[])
      .map((p) => p.onesignal_external_id).filter((x): x is string => !!x);
    if (!ext.length) return;
    const { sendOneSignalPush } = await import("@/lib/onesignal.server");
    await sendOneSignalPush({
      externalIds: ext,
      title: "⚠️ Lead sem plantonista",
      message: `${args.nome} · ${args.telefone} · ${args.origem.replace(/_/g, " ")} — escale alguém no Plantão`,
      url: "https://sistemanexus.app/vendas/plantao",
      data: { lead_id: args.leadId },
    });
  } catch (e) { console.warn("[lead-mensagem] push admin falhou", e); }
}
