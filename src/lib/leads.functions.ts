import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LeadEtapa = z.enum([
  "novos_leads", "em_atendimento", "visita_agendada",
  "proposta_enviada", "em_negociacao", "fechado_ganho", "fechado_perdido",
]);

export const updateLeadEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), etapa: LeadEtapa }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { etapa: data.etapa };
    if (data.etapa === "fechado_ganho" || data.etapa === "fechado_perdido") {
      patch.fechado_em = new Date().toISOString();
    }
    const { error } = await context.supabase.from("leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("lead_historico").insert({
      lead_id: data.id, user_id: context.userId, acao: "mudou_etapa",
      detalhe: { etapa: data.etapa },
    });
    return { ok: true };
  });

export const markFirstResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase
      .from("leads").select("first_response_at").eq("id", data.id).maybeSingle();
    if (lead?.first_response_at) return { ok: true, already: true };
    const { error } = await context.supabase
      .from("leads").update({ first_response_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("lead_historico").insert({
      lead_id: data.id, user_id: context.userId, acao: "primeira_resposta",
    });
    return { ok: true };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    patch: z.object({
      nome: z.string().optional(),
      email: z.string().email().nullable().optional(),
      telefone: z.string().optional(),
      observacoes: z.string().nullable().optional(),
      canal: z.enum(["denise", "fabiola", "renata", "robson"]).optional(),
      responsavel_id: z.string().uuid().nullable().optional(),
      motivo_perda: z.string().nullable().optional(),
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("lead_historico").insert({
      lead_id: data.id, user_id: context.userId, acao: "editou_lead",
      detalhe: data.patch as Record<string, unknown>,
    });
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid(), nota: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_historico").insert({
      lead_id: data.lead_id, user_id: context.userId, acao: "nota",
      detalhe: { nota: data.nota },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
