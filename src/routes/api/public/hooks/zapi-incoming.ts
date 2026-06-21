// Webhook público: recebe respostas de mensagens recebidas via Z-API e tenta
// associar a uma pesquisa de satisfação pendente para extrair a nota (1-5).
// Configure no painel do Z-API o "on-message-received" apontando para:
//   https://<host>/api/public/hooks/zapi-incoming

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/zapi-incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = {};
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ ok: false, error: "json inválido" }), { status: 400 });
        }

        // Z-API "on-message-received": ignora mensagens enviadas pela própria conta.
        if (body?.fromMe === true) {
          return new Response(JSON.stringify({ ok: true, ignored: "fromMe" }), { status: 200 });
        }

        // Z-API envia o telefone do remetente em `phone` ou `senderPhone`.
        const telefone: string | undefined =
          body?.phone ?? body?.senderPhone ?? body?.participantPhone ?? body?.from;

        // Texto da mensagem (diferentes formatos do Z-API).
        const mensagem: string | undefined =
          body?.text?.message
          ?? body?.message?.text
          ?? body?.message
          ?? body?.body
          ?? body?.notificationMessage;

        if (!telefone || !mensagem) {
          return new Response(JSON.stringify({ ok: false, error: "campos ausentes" }), { status: 200 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("registrar_resposta_satisfacao", {
            _telefone: telefone,
            _mensagem: mensagem,
          });
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200 });
          }
          return new Response(JSON.stringify(data ?? { ok: true }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }), {
            status: 200,
          });
        }
      },
    },
  },
});
