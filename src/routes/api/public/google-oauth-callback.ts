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
        const redirectBack = (params: Record<string, string>) => {
          const qs = new URLSearchParams(params).toString();
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/configuracoes?${qs}` },
          });
        };

        if (error) return redirectBack({ google: "error", reason: error });
        if (!code || !state) return redirectBack({ google: "error", reason: "missing_params" });

        const { verifyState, exchangeCodeForTokens, fetchGoogleEmail } = await import(
          "@/lib/google.server"
        );
        const userId = verifyState(state);
        if (!userId) return redirectBack({ google: "error", reason: "bad_state" });

        const redirectUri = `${origin}/api/public/google-oauth-callback`;
        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            // Will only happen on subsequent connects; ask user to revoke and retry.
            return redirectBack({ google: "error", reason: "no_refresh_token" });
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
          return redirectBack({ google: "connected" });
        } catch (e) {
          console.error("[GoogleOAuth] callback failed", e);
          return redirectBack({ google: "error", reason: "exchange_failed" });
        }
      },
    },
  },
});
