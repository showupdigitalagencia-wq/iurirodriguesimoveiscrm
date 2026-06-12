export async function sendZapiMessage(phone: string, message: string): Promise<{ ok: boolean; resp?: unknown; error?: string }> {
  const instance = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Z-API não configurada" };
  }
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone, message }),
    });
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, resp: json, error: resp.ok ? undefined : `HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro de rede" };
  }
}

export function formatLeadMessage(lead: {
  nome: string; telefone: string; email?: string | null;
  regiao: string; tipo_imovel?: string | null; faixa_valor?: string | null;
  observacoes?: string | null; is_corretor?: boolean;
}): string {
  const lines = [
    "*Novo lead — Iuri Rodrigues Imóveis*", "",
    `*Nome:* ${lead.nome}`,
    `*Telefone:* ${lead.telefone}`,
  ];
  if (lead.email) lines.push(`*Email:* ${lead.email}`);
  lines.push(`*Região:* ${lead.regiao}`);
  if (lead.tipo_imovel) lines.push(`*Tipo de imóvel:* ${lead.tipo_imovel}`);
  if (lead.faixa_valor) lines.push(`*Faixa:* ${lead.faixa_valor}`);
  if (lead.is_corretor) lines.push("_Lead é corretor parceiro_");
  if (lead.observacoes) lines.push(`*Observações:* ${lead.observacoes}`);
  return lines.join("\n");
}
