// Server-only: envia notificação push via OneSignal REST API.
// Nunca importe este arquivo em código de cliente.

type SendArgs = {
  externalId?: string;
  externalIds?: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
};

export async function sendOneSignalPush(args: SendArgs): Promise<{ ok: boolean; resp?: unknown; error?: string }> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) return { ok: false, error: "OneSignal não configurado" };

  const ids = args.externalIds ?? (args.externalId ? [args.externalId] : []);
  if (ids.length === 0) return { ok: false, error: "Nenhum destinatário" };

  const body = {
    app_id: appId,
    target_channel: "push",
    include_aliases: { external_id: ids },
    headings: { en: args.title, pt: args.title },
    contents: { en: args.message, pt: args.message },
    url: args.url,
    data: args.data ?? {},
    web_url: args.url,
  };

  try {
    const resp = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${restKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) return { ok: false, resp: json, error: `HTTP ${resp.status}` };
    // OneSignal devolve `errors` mesmo em 200 quando ninguém recebeu
    if (json.errors) return { ok: false, resp: json, error: JSON.stringify(json.errors) };
    return { ok: true, resp: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro de rede" };
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
