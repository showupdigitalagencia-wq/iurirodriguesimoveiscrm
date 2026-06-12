import type { Database } from "@/integrations/supabase/types";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type LeadEtapa = Database["public"]["Enums"]["lead_etapa"];
export type LeadCanal = Database["public"]["Enums"]["lead_canal"];
export type LeadRegiao = Database["public"]["Enums"]["lead_regiao"];

export const ETAPAS: { id: LeadEtapa; nome: string }[] = [
  { id: "novos_leads", nome: "Novos Leads" },
  { id: "em_atendimento", nome: "Em Atendimento" },
  { id: "reuniao_agendada", nome: "Reunião Agendada" },
  { id: "documentos_enviados", nome: "Documentos Enviados" },
  { id: "em_negociacao", nome: "Em Negociação" },
  { id: "follow_up", nome: "Follow Up" },
  { id: "fechado", nome: "Fechado" },
  { id: "descartado", nome: "Descartado" },
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
  if (lead.etapa === "fechado_ganho" || lead.etapa === "fechado_perdido") {
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
