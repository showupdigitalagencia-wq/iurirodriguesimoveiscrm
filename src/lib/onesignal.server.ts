// Server-only: envia notificação push via OneSignal REST API.
// Nunca importe este arquivo em código de cliente.

type SendArgs = {
  externalId?: string;
  externalIds?: string[];
  segments?: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
};

function keyMeta(k: string | undefined) {
  if (!k) return { present: false };
  return { present: true, length: k.length, prefix: k.slice(0, 4), suffix: k.slice(-4) };
}

export async function sendOneSignalPush(args: SendArgs): Promise<{ ok: boolean; resp?: unknown; error?: string; debug?: unknown }> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  console.info("[OneSignal] ENV check", {
    hasAppId: !!appId,
    appIdMeta: keyMeta(appId),
    restKeyMeta: keyMeta(restKey),
    nodeEnv: process.env.NODE_ENV,
  });
  if (!appId || !restKey) {
    console.error("[OneSignal] Variáveis ausentes", { hasAppId: !!appId, hasRestKey: !!restKey });
    return { ok: false, error: "OneSignal não configurado (ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY ausentes no ambiente de produção)" };
  }

  const ids = args.externalIds ?? (args.externalId ? [args.externalId] : []);
  const segments = args.segments ?? [];
  if (ids.length === 0 && segments.length === 0) return { ok: false, error: "Nenhum destinatário" };

  const body: Record<string, unknown> = {
    app_id: appId,
    headings: { en: args.title },
    contents: { en: args.message },
    url: args.url,
  };
  if (args.data) body.data = args.data;
  if (ids.length && segments.length === 0) {
    body.include_aliases = { external_id: ids };
    body.include_external_user_ids = ids;
  }
  if (segments.length) body.included_segments = segments;

  const apiUrl = "https://api.onesignal.com/notifications?c=push";
  const headersSent = {
    "Content-Type": "application/json",
    Authorization: `Key ${restKey}`,
  };
  const bodyStr = JSON.stringify(body);

  console.info("[OneSignal] >>> REQUEST", {
    url: apiUrl,
    method: "POST",
    headers: { "Content-Type": headersSent["Content-Type"], Authorization: `Key ****${restKey.slice(-4)} (len=${restKey.length})` },
    body,
  });

  try {
    const resp = await fetch(apiUrl, { method: "POST", headers: headersSent, body: bodyStr });
    const respText = await resp.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(respText) as Record<string, unknown>; } catch { /* not json */ }
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });

    console.info("[OneSignal] <<< RESPONSE", {
      status: resp.status,
      ok: resp.ok,
      headers: respHeaders,
      bodyRaw: respText,
      bodyJson: json,
      externalIds: ids,
      segments,
    });

    const debug = { request: { url: apiUrl, body }, response: { status: resp.status, headers: respHeaders, body: json, raw: respText } };
    if (!resp.ok) return { ok: false, resp: json, error: `HTTP ${resp.status}: ${respText}`, debug };
    if (json.errors) return { ok: false, resp: json, error: JSON.stringify(json.errors), debug };
    return { ok: true, resp: json, debug };
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : "erro de rede";
    console.error("[OneSignal] FETCH FAILED", { error: msg, cause: e });
    return { ok: false, error: msg };
  }
}

export function formatPushLead(lead: {
  nome: string; telefone: string; email?: string | null;
  regiao: string; tipo_imovel?: string | null; faixa_valor?: string | null;
  observacoes?: string | null; is_corretor?: boolean;
  dados_corretor?: Record<string, unknown> | null;
}): { title: string; message: string } {
  if (lead.is_corretor) {
    const d = lead.dados_corretor ?? {};
    const parts: string[] = [lead.telefone];
    if (lead.email) parts.push(lead.email);
    if (d.ja_corretor) parts.push(`Atua: ${d.ja_corretor}`);
    if (d.creci_ativo) parts.push(`CRECI: ${d.creci_ativo}${d.numero_creci ? ` (${d.numero_creci})` : ""}`);
    if (d.disponibilidade_barra) parts.push(`Barra: ${d.disponibilidade_barra}`);
    if (d.disponibilidade_video) parts.push(`Vídeo: ${d.disponibilidade_video}`);
    if (d.possui_veiculo) parts.push(`Veículo: ${d.possui_veiculo}`);
    return {
      title: `Novo corretor: ${lead.nome}`,
      message: parts.join(" · "),
    };
  }
  const parts: string[] = [lead.telefone];
  if (lead.email) parts.push(lead.email);
  parts.push(lead.regiao.replace(/_/g, " "));
  if (lead.tipo_imovel) parts.push(lead.tipo_imovel);
  if (lead.faixa_valor) parts.push(lead.faixa_valor);
  return {
    title: `Novo lead: ${lead.nome}`,
    message: parts.join(" · "),
  };
}
