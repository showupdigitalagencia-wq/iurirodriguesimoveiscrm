import type { Database } from "@/integrations/supabase/types";

export type VendasLead = Database["public"]["Tables"]["vendas_leads"]["Row"];
export type VendasEtapa = Database["public"]["Enums"]["vendas_etapa"];
export type VendasTipo = Database["public"]["Enums"]["vendas_tipo"];

export const VENDAS_ETAPAS: { id: VendasEtapa; nome: string; emoji: string; color: string; dot: string; hex: string }[] = [
  { id: "novo_lead",        nome: "Novo Lead",         emoji: "🔵", color: "bg-blue-500/15 text-blue-700 border-blue-300",     dot: "bg-blue-500",  hex: "var(--stage-ven-novo)" },
  { id: "contato_realizado",nome: "Contato Realizado", emoji: "🟠", color: "bg-orange-500/15 text-orange-700 border-orange-300", dot: "bg-orange-500", hex: "var(--stage-ven-contato)" },
  { id: "visita_agendada",  nome: "Visita Agendada",   emoji: "🟡", color: "bg-yellow-500/20 text-yellow-800 border-yellow-300", dot: "bg-yellow-500", hex: "var(--stage-ven-visita)" },
  { id: "proposta_enviada", nome: "Proposta Enviada",  emoji: "🟣", color: "bg-purple-500/15 text-purple-700 border-purple-300", dot: "bg-purple-500", hex: "var(--stage-ven-proposta)" },
  { id: "em_negociacao",    nome: "Em Negociação",     emoji: "🩷", color: "bg-pink-500/15 text-pink-700 border-pink-300",       dot: "bg-pink-500",   hex: "var(--stage-ven-negociacao)" },
  { id: "follow_up",        nome: "Follow Up",         emoji: "⚫", color: "bg-zinc-500/15 text-zinc-700 border-zinc-300",       dot: "bg-zinc-600",   hex: "var(--stage-ven-followup)" },
  { id: "fechado",          nome: "Fechado",           emoji: "🟢", color: "bg-green-600/15 text-green-700 border-green-300",    dot: "bg-green-600",  hex: "var(--stage-ven-fechado)" },
  { id: "perdido",          nome: "Perdido",           emoji: "🔴", color: "bg-red-600/15 text-red-700 border-red-300",          dot: "bg-red-600",    hex: "var(--stage-ven-perdido)" },
];

export function vendasEtapaInfo(id: VendasEtapa) {
  return VENDAS_ETAPAS.find((e) => e.id === id) ?? VENDAS_ETAPAS[0];
}

export function formatBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
