// Helpers usados tanto por server fns quanto por webhooks
export type LeadOrigem = "zap_imoveis" | "olx" | "site" | "whatsapp_empresa" | "facebook" | "manual" | "outro";

export const FIXED_REGIONS = new Set([
  "barra_da_tijuca",
  "recreio",
  "belford_roxo",
  "nilopolis",
  "mesquita",
]);

export function normalizeOrigem(input: string | undefined | null): LeadOrigem {
  if (!input) return "facebook"; // default histórico do webhook Meta
  const v = String(input).toLowerCase().trim().replace(/\s+/g, "_");
  if (v.includes("zap")) return "zap_imoveis";
  if (v.includes("olx")) return "olx";
  if (v === "site" || v.includes("website") || v.includes("landing")) return "site";
  if (v.includes("whatsapp")) return "whatsapp_empresa";
  if (v.includes("facebook") || v.includes("meta") || v.includes("instagram") || v.includes("fb")) return "facebook";
  if (v === "manual") return "manual";
  return "outro";
}

export function shouldUsePlantao(origem: LeadOrigem, regiao: string): boolean {
  // Plantão: tudo que NÃO for facebook+região fixa conhecida
  return !(origem === "facebook" && FIXED_REGIONS.has(regiao));
}
