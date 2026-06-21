import { createFileRoute } from "@tanstack/react-router";

// Roda 1x/dia às 7h Brasília (= 10:00 UTC).
// Envia push para o plantonista do dia avisando que está de plantão.
// Dedup: marca `notificado_em` na linha de plantao_escala após enviar.

export const Route = createFileRoute("/api/public/cron-plantao-diario")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, info: "Plantão daily push cron" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");

        // Data "hoje" em America/Sao_Paulo (UTC-3 sem DST atualmente).
        // Ex.: 2026-06-22 (string YYYY-MM-DD) — bate com o tipo `data` em plantao_escala.
        const now = new Date();
        const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const hoje = `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}-${String(brt.getUTCDate()).padStart(2, "0")}`;

        const { data: escalaRaw, error: escalaErr } = await supabaseAdmin
          .from("plantao_escala" as never)
          .select("id, corretor_id, notificado_em")
          .eq("data", hoje)
          .maybeSingle();
        if (escalaErr) {
          return new Response(JSON.stringify({ ok: false, error: escalaErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        const escala = escalaRaw as { id: string; corretor_id: string; notificado_em: string | null } | null;
        if (!escala) {
          return new Response(JSON.stringify({ ok: true, hoje, skipped: "sem plantonista escalado" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        if (escala.notificado_em) {
          return new Response(JSON.stringify({ ok: true, hoje, skipped: "ja_notificado", notificado_em: escala.notificado_em }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const { data: profRaw } = await supabaseAdmin
          .from("profiles")
          .select("id, nome, onesignal_external_id")
          .eq("id", escala.corretor_id)
          .maybeSingle();
        const prof = profRaw as { id: string; nome: string; onesignal_external_id: string | null } | null;
        if (!prof?.onesignal_external_id) {
          return new Response(JSON.stringify({ ok: false, hoje, error: "plantonista sem onesignal_external_id", corretor: prof?.nome ?? null }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const primeiroNome = (prof.nome || "").trim().split(/\s+/)[0] || "Plantonista";
        const res = await sendOneSignalPush({
          externalIds: [prof.onesignal_external_id],
          title: "📅 Hoje é o seu plantão!",
          message: `${primeiroNome}, fique de olho nos leads de hoje.`,
          url: "https://sistemanexus.app/vendas",
          data: { tipo: "plantao_diario", data: hoje },
        });

        if (res.ok) {
          await supabaseAdmin
            .from("plantao_escala" as never)
            .update({ notificado_em: new Date().toISOString() } as never)
            .eq("id", escala.id);
        }

        return new Response(JSON.stringify({ ok: res.ok, hoje, corretor: prof.nome, error: res.error }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
