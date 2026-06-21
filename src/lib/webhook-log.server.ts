// Server-only helper: registra cada chamada de webhook em public.webhook_log
// Consumido pelo card "Webhooks" do Dashboard de Saúde do Sistema (get_saude_sistema).

export type WebhookFonte =
  | "zap_imoveis"
  | "olx"
  | "site"
  | "whatsapp_empresa"
  | "facebook"
  | "outro";

export async function logWebhookCall(opts: {
  fonte: WebhookFonte | string;
  status_code: number;
  sucesso: boolean;
  erro?: string | null;
  payload_resumo?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("webhook_log" as never).insert({
      fonte: opts.fonte,
      status_code: opts.status_code,
      sucesso: opts.sucesso,
      erro: opts.erro ?? null,
      payload_resumo: (opts.payload_resumo ?? null) as never,
    } as never);
  } catch (e) {
    // Nunca derruba o webhook por causa de log.
    console.warn("[webhook_log] insert falhou", e);
  }
}

export function detectFonte(body: unknown, fallback: WebhookFonte = "outro"): WebhookFonte {
  if (!body || typeof body !== "object") return fallback;
  const b = body as Record<string, unknown>;

  // Evolution API (WhatsApp da empresa): shape { event, data: { key: { remoteJid } } }
  const ev = String(b.event ?? "").toLowerCase();
  if (ev.includes("message")) return "whatsapp_empresa";
  if (b.data && typeof b.data === "object") {
    const d = b.data as Record<string, unknown>;
    if (d.key && typeof d.key === "object") return "whatsapp_empresa";
  }

  // Meta Lead Ads
  if (b.field_data || b.fields || b.leadgen_id || b.form_id) return "facebook";

  // origem/source explícito
  const o = String(b.origem ?? b.source ?? "").toLowerCase();
  if (o.includes("zap")) return "zap_imoveis";
  if (o.includes("olx")) return "olx";
  if (o.includes("site") || o.includes("website") || o.includes("landing") || o === "formulario_site") return "site";
  if (o.includes("whatsapp")) return "whatsapp_empresa";
  if (o.includes("facebook") || o.includes("meta") || o.includes("fb") || o.includes("instagram")) return "facebook";

  return fallback;
}

export function summarizePayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    return { tipo: typeof body };
  }
  const b = body as Record<string, unknown>;
  const tel = b.telefone ?? b.phone ?? b.celular ?? b.whatsapp;
  return {
    keys: Object.keys(b).slice(0, 25),
    event: b.event ?? null,
    origem: b.origem ?? b.source ?? null,
    form_id: b.form_id ?? null,
    has_field_data: Array.isArray(b.field_data) || Array.isArray((b as { fields?: unknown }).fields),
    telefone_presente: !!tel,
  };
}

/**
 * Envolve um handler de webhook capturando a resposta e gravando em webhook_log.
 * - Lê o body uma vez (clonando o Request) para detecção de fonte + resumo
 * - Captura exceções não tratadas como erro 500
 * - Nunca propaga falha de log para o cliente
 */
export async function withWebhookLog(
  request: Request,
  run: (request: Request, parsedBody: unknown) => Promise<Response>,
  opts: { fonteFallback?: WebhookFonte; fonteOverride?: WebhookFonte } = {},
): Promise<Response> {
  let parsed: unknown = null;
  try {
    const clone = request.clone();
    parsed = await clone.json();
  } catch {
    // body inválido ou vazio
  }

  let res: Response;
  let erroMsg: string | null = null;
  try {
    res = await run(request, parsed);
  } catch (e) {
    erroMsg = e instanceof Error ? e.message : String(e);
    console.error("[webhook] handler lançou exceção", e);
    res = new Response(JSON.stringify({ error: erroMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fonte = opts.fonteOverride ?? detectFonte(parsed, opts.fonteFallback ?? "outro");
  const sucesso = res.status >= 200 && res.status < 300;

  if (!sucesso && !erroMsg) {
    try {
      const txt = await res.clone().text();
      if (txt) {
        try {
          const j = JSON.parse(txt) as { error?: unknown };
          erroMsg = j.error ? String(j.error) : txt.slice(0, 500);
        } catch {
          erroMsg = txt.slice(0, 500);
        }
      } else {
        erroMsg = `HTTP ${res.status}`;
      }
    } catch {
      erroMsg = `HTTP ${res.status}`;
    }
  }

  await logWebhookCall({
    fonte,
    status_code: res.status,
    sucesso,
    erro: sucesso ? null : erroMsg,
    payload_resumo: summarizePayload(parsed),
  });

  return res;
}
