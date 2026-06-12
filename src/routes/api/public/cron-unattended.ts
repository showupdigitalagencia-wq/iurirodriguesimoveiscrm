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
        const { sendZapiMessage } = await import("@/lib/notify.server");
        let sent = 0;
        for (const lead of leads) {
          const { data: prev } = await supabaseAdmin
            .from("notificacoes").select("id").eq("lead_id", lead.id)
            .eq("tipo", "whatsapp_alerta_sla")
            .gte("created_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString()).limit(1);
          if (prev && prev.length > 0) continue;
          if (!lead.responsavel_id) continue;
          const { data: resp } = await supabaseAdmin
            .from("responsaveis").select("whatsapp").eq("id", lead.responsavel_id).maybeSingle();
          if (!resp?.whatsapp) continue;
          const msg = `*⚠️ Lead sem resposta há mais de 1h*\n\n*Nome:* ${lead.nome}\n*Telefone:* ${lead.telefone}\n*Região:* ${lead.regiao}\n\nResponda o quanto antes pelo CRM.`;
          const result = await sendZapiMessage(resp.whatsapp, msg);
          await supabaseAdmin.from("notificacoes").insert({
            lead_id: lead.id, tipo: "whatsapp_alerta_sla", destino: resp.whatsapp,
            status: result.ok ? "enviado" : "falha",
            payload: { message: msg },
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
