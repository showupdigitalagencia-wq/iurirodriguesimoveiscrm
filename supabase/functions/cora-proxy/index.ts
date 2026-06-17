// Cora API proxy with mTLS (client certificate) authentication.
// Scaffold only — certificate/key secrets will be wired in the next step.
//
// Authentication flow:
// 1. Caller must send a valid Supabase JWT (verify_jwt = true by default).
// 2. This function loads CORA_CERT_PEM + CORA_KEY_PEM from env and creates
//    a Deno HTTP client with mTLS, then proxies the request to Cora.
//
// Endpoints to implement in next phase:
//   POST /token            -> OAuth2 client_credentials (mTLS)
//   GET  /invoices         -> List invoices
//   POST /invoices         -> Create invoice (boleto/pix)
//   GET  /invoices/:id     -> Get invoice
//   DEL  /invoices/:id     -> Cancel invoice
//   POST /webhooks         -> Register webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const CORA_BASE_URL = "https://matls-clients.api.cora.com.br";

interface ProxyRequest {
  action: "ping" | "token" | "list_invoices" | "create_invoice" | "get_invoice" | "cancel_invoice";
  payload?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- 1. Validate caller (Supabase JWT) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // --- 2. Authorize: only admin or administrativo roles ---
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "administrativo");
    if (!allowed) {
      return json({ error: "Forbidden" }, 403);
    }

    // --- 3. Load secrets ---
    const clientId = Deno.env.get("CORA_API_KEY");
    const cnpj = Deno.env.get("CORA_CNPJ");
    const certPem = Deno.env.get("CORA_CERT_PEM");
    const keyPem = Deno.env.get("CORA_KEY_PEM");

    const { action, payload }: ProxyRequest = await req.json().catch(() => ({ action: "ping" }));

    if (action === "ping") {
      return json({
        ok: true,
        message: "cora-proxy scaffold online",
        secretsConfigured: {
          CORA_API_KEY: !!clientId,
          CORA_CNPJ: !!cnpj,
          CORA_CERT_PEM: !!certPem,
          CORA_KEY_PEM: !!keyPem,
        },
        coraBaseUrl: CORA_BASE_URL,
      });
    }

    if (!certPem || !keyPem) {
      return json(
        {
          error: "mTLS certificate not configured",
          hint: "Set CORA_CERT_PEM and CORA_KEY_PEM secrets to enable Cora calls.",
        },
        503,
      );
    }

    // --- 4. mTLS client (to be wired in next phase) ---
    // const client = Deno.createHttpClient({ cert: certPem, key: keyPem });
    // const coraRes = await fetch(`${CORA_BASE_URL}/...`, { client, ... });

    return json({ error: `Action '${action}' not implemented yet`, payload }, 501);
  } catch (e) {
    console.error("[cora-proxy] error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
