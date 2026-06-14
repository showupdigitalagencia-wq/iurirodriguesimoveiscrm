import { createFileRoute } from "@tanstack/react-router";

// Endpoint público de diagnóstico OneSignal.
// GET  -> mostra metadados de env (sem expor a chave) e faz um GET autenticado em /apps/{id}
// POST -> dispara uma notificação real para o segmento "Subscribed Users" e retorna a resposta crua
// Uso (produção):
//   GET  https://<domínio>/api/public/onesignal-test
//   POST https://<domínio>/api/public/onesignal-test   (body opcional: {"title":"...","message":"..."})

function meta(k: string | undefined) {
  if (!k) return { present: false };
  return { present: true, length: k.length, prefix: k.slice(0, 4), suffix: k.slice(-4) };
}

async function callOneSignal(url: string, init: RequestInit) {
  const started = Date.now();
  try {
    const resp = await fetch(url, init);
    const text = await resp.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* keep raw */ }
    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => { headers[k] = v; });
    return { ok: resp.ok, status: resp.status, headers, body: json, raw: text, ms: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      cause: (e as { cause?: unknown })?.cause ? String((e as { cause?: unknown }).cause) : null,
      ms: Date.now() - started,
    };
  }
}

export const Route = createFileRoute("/api/public/onesignal-test")({
  server: {
    handlers: {
      GET: async () => {
        const appId = process.env.ONESIGNAL_APP_ID;
        const restKey = process.env.ONESIGNAL_REST_API_KEY;

        const env = {
          appIdMeta: meta(appId),
          restKeyMeta: meta(restKey),
          nodeEnv: process.env.NODE_ENV ?? null,
        };

        if (!appId || !restKey) {
          return new Response(JSON.stringify({ ok: false, env, error: "ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY não acessíveis em runtime" }, null, 2), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        // Tenta autenticar com ambos schemes — útil pra saber se a chave é V2 (Key) ou legacy (Basic)
        const appUrl = `https://api.onesignal.com/apps/${appId}`;
        const withKey = await callOneSignal(appUrl, { method: "GET", headers: { Authorization: `Key ${restKey}` } });
        const withBasic = await callOneSignal(appUrl, { method: "GET", headers: { Authorization: `Basic ${restKey}` } });

        return new Response(JSON.stringify({
          ok: withKey.ok || withBasic.ok,
          env,
          tests: {
            "GET /apps/{id} with 'Key <token>'": withKey,
            "GET /apps/{id} with 'Basic <token>'": withBasic,
          },
        }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
      },

      POST: async ({ request }) => {
        const appId = process.env.ONESIGNAL_APP_ID;
        const restKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!appId || !restKey) {
          return new Response(JSON.stringify({ ok: false, error: "ONESIGNAL não configurado" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        let input: { title?: string; message?: string } = {};
        try { input = await request.json(); } catch { /* sem body */ }
        const title = input.title ?? "Teste OneSignal";
        const message = input.message ?? `Teste de envio ${new Date().toISOString()}`;

        const url = "https://api.onesignal.com/notifications?c=push";
        const body = {
          app_id: appId,
          target_channel: "push",
          included_segments: ["Subscribed Users", "All"],
          headings: { en: title, pt: title },
          contents: { en: message, pt: message },
        };

        const result = await callOneSignal(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Key ${restKey}` },
          body: JSON.stringify(body),
        });

        console.info("[OneSignal TEST] POST result", { request: { url, body }, response: result });

        return new Response(JSON.stringify({
          request: { url, headers: { Authorization: `Key ****${restKey.slice(-4)}` }, body },
          response: result,
        }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
