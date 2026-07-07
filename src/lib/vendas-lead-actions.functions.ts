import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ETAPAS = [
  "novo_lead",
  "contato_realizado",
  "visita_agendada",
  "proposta_enviada",
  "em_negociacao",
  "fechado",
  "perdido",
] as const;

/**
 * Atualiza a etapa do lead (respeitando RLS) e notifica corretor + executivo
 * gestor da equipe. Uso: qualquer troca de etapa que NÃO seja "fechado"
 * (fechado tem fluxo próprio via fecharLeadVendas).
 */
export const updateVendasLeadEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      lead_id: z.string().uuid(),
      etapa: z.enum(ETAPAS),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prev } = await context.supabase
      .from("vendas_leads")
      .select("etapa, nome")
      .eq("id", data.lead_id)
      .maybeSingle();
    const prevEtapa = (prev as { etapa: string | null } | null)?.etapa ?? null;
    const nome = (prev as { nome: string | null } | null)?.nome ?? "Lead";

    const { error } = await context.supabase
      .from("vendas_leads")
      .update({ etapa: data.etapa } as never)
      .eq("id", data.lead_id);
    if (error) throw new Error(error.message);

    if (prevEtapa !== data.etapa) {
      const { notifyVendasLeadStakeholders } = await import("@/lib/vendas-notify.server");
      const labels: Record<string, string> = {
        novo_lead: "Novo lead",
        contato_realizado: "Contato realizado",
        visita_agendada: "Visita agendada",
        proposta_enviada: "Proposta enviada",
        em_negociacao: "Em negociação",
        fechado: "Fechado",
        perdido: "Perdido",
      };
      await notifyVendasLeadStakeholders({
        leadId: data.lead_id,
        title: `📊 Etapa atualizada — ${nome}`,
        message: `Movido para "${labels[data.etapa] ?? data.etapa}"`,
        url: `https://sistemanexus.app/vendas/leads?open=${data.lead_id}`,
        data: { lead_id: data.lead_id, etapa: data.etapa },
        excludeUserId: context.userId,
      });
    }

    return { ok: true };
  });
