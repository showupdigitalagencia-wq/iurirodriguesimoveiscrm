import type { Database } from "@/integrations/supabase/types";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type LeadEtapa = Database["public"]["Enums"]["lead_etapa"];
export type LeadCanal = Database["public"]["Enums"]["lead_canal"];
export type LeadRegiao = Database["public"]["Enums"]["lead_regiao"];

export const ETAPAS: { id: LeadEtapa; nome: string }[] = [
  { id: "novos_leads", nome: "Novos Leads" },
  { id: "em_atendimento", nome: "Em Atendimento" },
  { id: "reuniao_agendada", nome: "Reunião Agendada" },
  { id: "solicitacao_documentos", nome: "Solicitação de Documentos" },
  { id: "documentos_enviados", nome: "Documentos Enviados" },
  { id: "em_negociacao", nome: "Em Negociação" },
  { id: "follow_up", nome: "Follow Up" },
  { id: "fechado", nome: "Fechado" },
  { id: "descartado", nome: "Descartado" },
  { id: "descredenciado", nome: "Descredenciado" },
];

export const REGIOES: { id: LeadRegiao; nome: string }[] = [
  { id: "barra_da_tijuca", nome: "Barra da Tijuca" },
  { id: "recreio", nome: "Recreio dos Bandeirantes" },
  { id: "belford_roxo", nome: "Belford Roxo" },
  { id: "nilopolis", nome: "Nilópolis" },
  { id: "mesquita", nome: "Mesquita" },
  { id: "jacarepagua", nome: "Jacarepaguá" },
  { id: "zona_sul", nome: "Zona Sul" },
  { id: "zona_norte", nome: "Zona Norte" },
  { id: "zona_oeste", nome: "Zona Oeste" },
  { id: "centro", nome: "Centro" },
  { id: "outras", nome: "Outras" },
];

export const CANAIS: { id: LeadCanal; nome: string }[] = [
  { id: "denise", nome: "Denise" },
  { id: "fabiola", nome: "Fabiola" },
  { id: "renata", nome: "Renata" },
  { id: "robson", nome: "Robson" },
];

export function maskPhone(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 10) {
    return v
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function urgencyForLead(lead: Pick<LeadRow, "created_at" | "first_response_at" | "etapa">): {
  level: "ok" | "warning" | "critical";
  minutes: number;
} {
  if (lead.etapa === "fechado" || lead.etapa === "descartado") {
    return { level: "ok", minutes: 0 };
  }
  if (lead.first_response_at) return { level: "ok", minutes: 0 };
  const minutes = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 60000);
  if (minutes >= 60) return { level: "critical", minutes };
  if (minutes >= 30) return { level: "warning", minutes };
  return { level: "ok", minutes };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export function etapaNome(id: LeadEtapa): string {
  return ETAPAS.find((e) => e.id === id)?.nome ?? id;
}
export function regiaoNome(id: LeadRegiao): string {
  return REGIOES.find((r) => r.id === id)?.nome ?? id;
}
export function canalNome(id: LeadCanal): string {
  return CANAIS.find((c) => c.id === id)?.nome ?? id;
}

const EXECUTIVO_CANAIS = new Set<string>(["robson", "fabiola", "renata", "denise"]);

export type CargoTitulo = "EXECUTIVO" | "CORRETOR" | "ADMINISTRADOR";

export function cargoTitulo(opts: { isAdmin?: boolean; canal?: string | null }): CargoTitulo {
  if (opts.isAdmin) return "ADMINISTRADOR";
  if (opts.canal && EXECUTIVO_CANAIS.has(opts.canal)) return "EXECUTIVO";
  return "CORRETOR";
}

export const ETAPA_COLORS: Record<LeadEtapa, {
  badge: string;     // bg + text + border for badges/pills
  bar: string;       // solid bg for column headers / side bars
  border: string;    // border color for card left border
  dot: string;       // bg color for small swatches
}> = {
  novos_leads:         { badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",       bar: "bg-blue-500",   border: "border-l-blue-500",   dot: "bg-blue-500" },
  em_atendimento:      { badge: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30", bar: "bg-orange-500", border: "border-l-orange-500", dot: "bg-orange-500" },
  reuniao_agendada:    { badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30", bar: "bg-yellow-500", border: "border-l-yellow-500", dot: "bg-yellow-500" },
  solicitacao_documentos: { badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/50", bar: "bg-amber-800", border: "border-l-amber-800", dot: "bg-amber-800" },
  documentos_enviados: { badge: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30", bar: "bg-purple-500", border: "border-l-purple-500", dot: "bg-purple-500" },
  em_negociacao:       { badge: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",       bar: "bg-pink-500",   border: "border-l-pink-500",   dot: "bg-pink-500" },
  follow_up:           { badge: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/30",       bar: "bg-gray-500",   border: "border-l-gray-500",   dot: "bg-gray-500" },
  fechado:             { badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30", bar: "bg-green-500",  border: "border-l-green-500",  dot: "bg-green-500" },
  descartado:          { badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",             bar: "bg-red-500",    border: "border-l-red-500",    dot: "bg-red-500" },
};

export function etapaColor(id: LeadEtapa) {
  return ETAPA_COLORS[id] ?? ETAPA_COLORS.novos_leads;
}
