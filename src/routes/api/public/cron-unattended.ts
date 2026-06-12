import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron-unattended")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: leads } = await supabaseAdmin
          .from("leads")
          .select("id, nome, telefone, regiao, canal, created_at, responsavel_id")
          .is("first_response_at", null)
          .in("etapa", ["novos_leads", "em_atendimento"])
          .lt("created_at", cutoff);

        if (!leads || leads.length === 0) {
          return new Response(JSON.stringify({ ok: true, count: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");
        let sent = 0;
        for (const lead of leads) {
          const { data: prev } = await supabaseAdmin
            .from("notificacoes").select("id").eq("lead_id", lead.id)
            .eq("tipo", "push_alerta_sla")
            .gte("created_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString()).limit(1);
          if (prev && prev.length > 0) continue;
          if (!lead.responsavel_id) continue;

          const url = `https://iurirodriguesimoveiscrmcombr.lovable.app/leads?lead=${lead.id}`;
          const result = await sendOneSignalPush({
            externalId: lead.responsavel_id,
            title: `⚠️ Lead sem resposta há +1h: ${lead.nome}`,
            message: `${lead.telefone} · ${lead.regiao.replace(/_/g, " ")} — abra o CRM e responda.`,
            url,
            data: { lead_id: lead.id, alerta_sla: true },
          });
          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id, tipo: "push_alerta_sla", destino: lead.responsavel_id,
            status: result.ok ? "enviado" : "falha",
            payload: { url } as never,
            resposta: (result.resp ?? { error: result.error }) as never,
          });
          if (result.ok) sent++;
        }
        return new Response(JSON.stringify({ ok: true, count: sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
