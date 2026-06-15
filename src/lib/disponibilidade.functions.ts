import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DisponibilidadeRow = {
  id: string;
  corretor_id: string;
  tipo: "recorrente" | "bloqueio";
  dia_semana: number | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacao: string | null;
};

export const listDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ corretor_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const target = data.corretor_id ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("corretor_disponibilidade" as never)
      .select("id, corretor_id, tipo, dia_semana, data, hora_inicio, hora_fim, observacao")
      .eq("corretor_id", target)
      .order("dia_semana", { ascending: true, nullsFirst: false })
      .order("data", { ascending: true, nullsFirst: false })
      .order("hora_inicio", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as unknown as DisponibilidadeRow[] };
  });

export const addRecorrente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    dia_semana: z.number().int().min(0).max(6),
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
    hora_fim: z.string().regex(/^\d{2}:\d{2}$/),
    observacao: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.hora_fim <= data.hora_inicio) throw new Error("Hora fim deve ser após hora início");
    const { error } = await context.supabase
      .from("corretor_disponibilidade" as never)
      .insert({
        corretor_id: context.userId,
        tipo: "recorrente",
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim,
        observacao: data.observacao ?? null,
      } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addBloqueio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    hora_fim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    observacao: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("corretor_disponibilidade" as never)
      .insert({
        corretor_id: context.userId,
        tipo: "bloqueio",
        data: data.data,
        hora_inicio: data.hora_inicio ?? null,
        hora_fim: data.hora_fim ?? null,
        observacao: data.observacao ?? null,
      } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("corretor_disponibilidade" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
