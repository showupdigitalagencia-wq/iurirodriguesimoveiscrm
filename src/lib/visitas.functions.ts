import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VisitaRow = {
  id: string;
  lead_id: string;
  corretor_id: string;
  endereco: string;
  imovel_id: string | null;
  data_inicio: string;
  duracao_min: number;
  observacoes: string | null;
  google_event_id: string | null;
  status: string;
};


export type ReuniaoCorretorRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  duracao_min: number;
  local: string | null;
  status: string;
  criado_por: string | null;
};

export const listVisitas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vendas_visitas" as never)
      .select("id, lead_id, corretor_id, endereco, data_inicio, duracao_min, observacoes, google_event_id, status, vendas_leads(nome, telefone)")
      .order("data_inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as unknown as (VisitaRow & { vendas_leads: { nome: string; telefone: string } | null })[] };
  });

export const listReunioesCorretor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reunioes" as never)
      .select("id, titulo, descricao, data_inicio, duracao_min, local, status, criado_por")
      .eq("tipo", "individual" as never)
      .order("data_inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as unknown as ReuniaoCorretorRow[] };
  });

export const createVisita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    lead_id: string;
    endereco: string;
    data_inicio: string;
    duracao_min?: number;
    observacoes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Insert visita
    const { data: visita, error } = await supabase
      .from("vendas_visitas" as never)
      .insert({
        lead_id: data.lead_id,
        corretor_id: userId,
        endereco: data.endereco,
        data_inicio: data.data_inicio,
        duracao_min: data.duracao_min ?? 60,
        observacoes: data.observacoes ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const visitaId = (visita as { id: string }).id;

    // 2. Move lead to "visita_agendada"
    const { data: leadRow } = await supabase
      .from("vendas_leads")
      .select("nome, telefone")
      .eq("id", data.lead_id)
      .maybeSingle();
    await supabase
      .from("vendas_leads")
      .update({ etapa: "visita_agendada" })
      .eq("id", data.lead_id);

    // 3. Google Calendar sync (best-effort)
    let googleEventId: string | null = null;
    try {
      const { createCalendarEventWithMeet } = await import("@/lib/google.server");
      const r = await createCalendarEventWithMeet({
        userId,
        summary: `Visita: ${leadRow?.nome ?? "Lead"} — ${data.endereco}`,
        description: data.observacoes ?? null,
        startISO: data.data_inicio,
        durationMin: data.duracao_min ?? 60,
      });
      if (r?.eventId) {
        googleEventId = r.eventId;
        await supabase
          .from("vendas_visitas" as never)
          .update({ google_event_id: googleEventId } as never)
          .eq("id", visitaId);
      }
    } catch (e) {
      console.warn("[visitas] google sync failed", e);
    }

    return {
      id: visitaId,
      googleEventId,
      lead: leadRow as { nome: string; telefone: string } | null,
    };
  });

export const deleteVisita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("vendas_visitas" as never)
      .select("google_event_id")
      .eq("id", data.id)
      .maybeSingle();
    const eventId = (row as { google_event_id: string | null } | null)?.google_event_id;
    if (eventId) {
      try {
        const { deleteCalendarEvent } = await import("@/lib/google.server");
        await deleteCalendarEvent({ userId: context.userId, eventId });
      } catch (e) {
        console.warn("[visitas] google delete failed", e);
      }
    }
    const { error } = await context.supabase
      .from("vendas_visitas" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyVendasLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vendas_leads")
      .select("id, nome, telefone, etapa")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as { id: string; nome: string; telefone: string; etapa: string }[] };
  });

export const createReuniaoOnlineVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    lead_id: string;
    data_inicio: string;
    duracao_min?: number;
    observacoes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lead } = await supabase
      .from("vendas_leads")
      .select("nome, telefone, email")
      .eq("id", data.lead_id)
      .maybeSingle();
    const leadRow = lead as { nome: string; telefone: string; email: string | null } | null;

    let meetLink: string | null = null;
    let googleEventId: string | null = null;
    try {
      const { createCalendarEventWithMeet } = await import("@/lib/google.server");
      const attendees = leadRow?.email && /.+@.+\..+/.test(leadRow.email) ? [leadRow.email] : [];
      const r = await createCalendarEventWithMeet({
        userId,
        summary: `Reunião Online: ${leadRow?.nome ?? "Lead"}`,
        description: data.observacoes ?? null,
        startISO: data.data_inicio,
        durationMin: data.duracao_min ?? 45,
        attendeesEmails: attendees,
      });
      meetLink = r?.meetLink ?? null;
      googleEventId = r?.eventId ?? null;
    } catch (e) {
      console.warn("[vendas] reunião online google meet falhou", e);
    }

    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes" as never)
      .insert({
        titulo: `Reunião online: ${leadRow?.nome ?? "Lead"}`,
        descricao: data.observacoes ?? null,
        data_inicio: data.data_inicio,
        duracao_min: data.duracao_min ?? 45,
        local: meetLink,
        tipo: "individual",
        criado_por: userId,
        google_event_ids: googleEventId ? [{ user_id: userId, event_id: googleEventId }] : [],
      } as never)
      .select("id")
      .single();
    if (reuniaoError || !reuniao) throw new Error(reuniaoError?.message ?? "Falha ao registrar reunião");
    if (reuniao) {
      const { error: participanteError } = await supabase
        .from("reuniao_participantes" as never)
        .insert({ reuniao_id: (reuniao as { id: string }).id, user_id: userId, added_by: userId } as never);
      if (participanteError) throw new Error(participanteError.message);
    }

    await supabase
      .from("vendas_leads")
      .update({ etapa: "proposta_enviada" })
      .eq("id", data.lead_id);

    return { meetLink, googleEventId, lead: leadRow, reuniaoId: (reuniao as { id: string } | null)?.id ?? null };
  });
