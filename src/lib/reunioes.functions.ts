import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoSchema = z.enum(["individual", "institucional"]);
const StatusSchema = z.enum(["agendada", "realizada", "cancelada"]);

export type ReuniaoTipo = z.infer<typeof TipoSchema>;
export type ReuniaoStatus = z.infer<typeof StatusSchema>;

export type ReuniaoRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  duracao_min: number;
  local: string | null;
  tipo: ReuniaoTipo;
  status: ReuniaoStatus;
  resultado: string | null;
  criado_por: string | null;
  created_at: string;
};

export type ReuniaoDetail = ReuniaoRow & {
  participantes_leads: { id: string; nome: string; telefone: string }[];
  participantes_corretores: { id: string; nome: string; canal: string }[];
};

const CreateInput = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).nullable().optional(),
  data_inicio: z.string().min(1),
  duracao_min: z.number().int().min(5).max(1440).default(60),
  local: z.string().max(500).nullable().optional(),
  tipo: TipoSchema,
  lead_ids: z.array(z.string().uuid()).default([]),
  responsavel_ids: z.array(z.string().uuid()).default([]),
  usar_meet: z.boolean().optional().default(false),
});

export const listReunioes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reunioes" as never)
      .select("*")
      .gte("data_inicio", data.from)
      .lte("data_inicio", data.to)
      .order("data_inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return { reunioes: (rows ?? []) as unknown as ReuniaoRow[] };
  });

export const getReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase
      .from("reunioes" as never).select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Reunião não encontrada");

    const { data: parts } = await context.supabase
      .from("reuniao_participantes" as never)
      .select("lead_id, responsavel_id")
      .eq("reuniao_id", data.id);

    const leadIds = (parts ?? []).map((p: { lead_id: string | null }) => p.lead_id).filter(Boolean) as string[];
    const respIds = (parts ?? []).map((p: { responsavel_id: string | null }) => p.responsavel_id).filter(Boolean) as string[];

    const [{ data: leads }, { data: resps }] = await Promise.all([
      leadIds.length
        ? context.supabase.from("leads").select("id, nome, telefone").in("id", leadIds)
        : Promise.resolve({ data: [] as { id: string; nome: string; telefone: string }[] }),
      respIds.length
        ? context.supabase.from("responsaveis").select("id, nome, canal").in("id", respIds)
        : Promise.resolve({ data: [] as { id: string; nome: string; canal: string }[] }),
    ]);

    return {
      ...(r as unknown as ReuniaoRow),
      participantes_leads: leads ?? [],
      participantes_corretores: resps ?? [],
    } as ReuniaoDetail;
  });

export const createReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("reunioes" as never)
      .insert({
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        data_inicio: data.data_inicio,
        duracao_min: data.duracao_min,
        local: data.local ?? null,
        tipo: data.tipo,
        criado_por: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao criar reunião");
    const reuniaoId = (inserted as { id: string }).id;

    // Participantes
    const rows: { reuniao_id: string; lead_id: string | null; responsavel_id: string | null }[] = [
      ...data.lead_ids.map((lid) => ({ reuniao_id: reuniaoId, lead_id: lid, responsavel_id: null })),
      ...data.responsavel_ids.map((rid) => ({ reuniao_id: reuniaoId, lead_id: null, responsavel_id: rid })),
    ];
    if (rows.length) {
      await supabaseAdmin.from("reuniao_participantes" as never).insert(rows as never);
    }

    // Google Meet: cria evento no Calendar de cada corretor conectado
    let finalLocal = data.local ?? null;
    if (data.usar_meet && data.responsavel_ids.length) {
      try {
        const { createCalendarEventWithMeet } = await import("@/lib/google.server");
        const [{ data: profilesRows }, { data: leadsRows }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, responsavel_id")
            .in("responsavel_id", data.responsavel_ids),
          data.lead_ids.length
            ? supabaseAdmin.from("leads").select("email").in("id", data.lead_ids)
            : Promise.resolve({ data: [] as { email: string | null }[] }),
        ]);
        const attendeesEmails = ((leadsRows ?? []) as { email: string | null }[])
          .map((l) => l.email)
          .filter((e): e is string => !!e && /.+@.+\..+/.test(e));
        const userIds = ((profilesRows ?? []) as { id: string; responsavel_id: string }[])
          .map((p) => p.id);
        let primaryMeetLink: string | null = null;
        for (const uid of userIds) {
          const ev = await createCalendarEventWithMeet({
            userId: uid,
            summary: data.titulo,
            description: data.descricao ?? null,
            startISO: data.data_inicio,
            durationMin: data.duracao_min,
            attendeesEmails,
          });
          if (ev?.meetLink && !primaryMeetLink) primaryMeetLink = ev.meetLink;
        }
        if (primaryMeetLink) {
          finalLocal = primaryMeetLink;
          await supabaseAdmin
            .from("reunioes" as never)
            .update({ local: primaryMeetLink } as never)
            .eq("id", reuniaoId);
        } else {
          console.warn("[Reuniao] usar_meet=true mas nenhum corretor conectado ao Google");
        }
      } catch (e) {
        console.error("[Reuniao] Google Meet falhou", e);
      }
    }



    // Move leads para reuniao_agendada
    if (data.lead_ids.length) {
      await supabaseAdmin.from("leads").update({ etapa: "reuniao_agendada" }).in("id", data.lead_ids);
      const historicoRows = data.lead_ids.map((lid) => ({
        lead_id: lid,
        user_id: context.userId,
        acao: "mudou_etapa",
        detalhe: { etapa: "reuniao_agendada", motivo: "reuniao_agendada", reuniao_id: reuniaoId } as never,
      }));
      await supabaseAdmin.from("lead_historico").insert(historicoRows);
    }

    // Notificação push para todos os corretores + admins
    try {
      const { sendOneSignalPush } = await import("@/lib/onesignal.server");
      const { data: profileCriador } = await supabaseAdmin
        .from("profiles").select("nome").eq("id", context.userId).maybeSingle();
      const nomeCriador = profileCriador?.nome ?? "Sistema";

      const dt = new Date(data.data_inicio);
      const dataStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const horaStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const tipoLabel = data.tipo === "institucional" ? "Institucional" : "Individual";

      const [{ data: allResp }, { data: adminRoles }] = await Promise.all([
        supabaseAdmin.from("responsaveis").select("onesignal_external_id"),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const adminIds = (adminRoles ?? []).map((r) => r.user_id);
      const { data: adminProfiles } = adminIds.length
        ? await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", adminIds)
        : { data: [] as { onesignal_external_id: string | null }[] };

      const externalIds = Array.from(new Set([
        ...((allResp ?? []).map((r) => r.onesignal_external_id).filter((x): x is string => !!x)),
        ...((adminProfiles ?? []).map((p) => p.onesignal_external_id).filter((x): x is string => !!x)),
      ]));

      const title = "Nova reunião agendada";
      const message = `Agendada por ${nomeCriador} | ${dataStr} às ${horaStr} | ${tipoLabel}`;
      const url = `https://iurirodriguesimoveiscrm.lovable.app/agenda?open=${reuniaoId}`;

      if (externalIds.length) {
        await sendOneSignalPush({ externalIds, title, message, url, data: { reuniao_id: reuniaoId } });
      } else {
        await sendOneSignalPush({ segments: ["All"], title, message, url, data: { reuniao_id: reuniaoId } });
      }
    } catch (e) {
      console.error("[Reuniao] push falhou", e);
    }

    return { id: reuniaoId, local: finalLocal };
  });

export const updateReuniaoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: StatusSchema,
    resultado: z.string().max(2000).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.resultado !== undefined) patch.resultado = data.resultado;
    const { error } = await context.supabase
      .from("reunioes" as never).update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reunioes" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
