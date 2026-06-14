import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const origin = `${url.protocol}//${url.host}`;
        const popupResponse = (status: "connected" | "error", reason?: string) => {
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>Google</title></head><body style="font-family:system-ui;padding:24px;background:#0a0a0a;color:#fafafa">
<p>${status === "connected" ? "✅ Google conectado!" : `❌ Falha: ${reason ?? "erro"}`}</p>
<p>Esta janela pode ser fechada.</p>
<script>
  try { if (window.opener) { window.opener.postMessage({ type: "google-oauth", status: ${JSON.stringify(status)}, reason: ${JSON.stringify(reason ?? null)} }, "*"); } } catch(e){}
  setTimeout(function(){ try { window.close(); } catch(e){} window.location.href = ${JSON.stringify(`${origin}/agenda?google=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`)}; }, 400);
</script>
</body></html>`;
          return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
        };

        if (error) return popupResponse("error", error);
        if (!code || !state) return popupResponse("error", "missing_params");

        const { verifyState, exchangeCodeForTokens, fetchGoogleEmail } = await import(
          "@/lib/google.server"
        );
        const userId = verifyState(state);
        if (!userId) return popupResponse("error", "bad_state");

        const redirectUri = `${origin}/api/public/google-oauth-callback`;
        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            return popupResponse("error", "no_refresh_token");
          }
          const email = await fetchGoogleEmail(tokens.access_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("google_tokens" as never)
            .upsert(
              {
                user_id: userId,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                scope: tokens.scope ?? null,
                google_email: email,
              } as never,
              { onConflict: "user_id" },
            );
          return popupResponse("connected");
        } catch (e) {
          console.error("[GoogleOAuth] callback failed", e);
          return popupResponse("error", "exchange_failed");
        }
      },
    },
  },
});
