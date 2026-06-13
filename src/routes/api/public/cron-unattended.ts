import { createFileRoute } from "@tanstack/react-router";

// SLA tracking foi removido. Endpoint mantido como no-op para evitar 404 em crons existentes.
export const Route = createFileRoute("/api/public/cron-unattended")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true, disabled: true }), { headers: { "Content-Type": "application/json" } }),
      POST: async () => new Response(JSON.stringify({ ok: true, disabled: true }), { headers: { "Content-Type": "application/json" } }),
    },
  },
});
