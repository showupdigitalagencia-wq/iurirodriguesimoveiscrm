import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoSchema = z.enum(["individual", "institucional", "alinhamento", "mentoria"]);
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
  recorrente?: boolean;
};

export type ReuniaoDetail = ReuniaoRow & {
  participantes_leads: { id: string; nome: string; telefone: string; added_by: string | null }[];
  participantes_corretores: { id: string; nome: string; canal: string }[];
  participantes_usuarios: { id: string; nome: string }[];
  my_role: "admin" | "corretor" | "corretor_vendas" | string;
  my_user_id: string;
  my_responsavel_id: string | null;
  is_executivo: boolean;
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
  user_ids: z.array(z.string().uuid()).default([]),
  usar_meet: z.boolean().optional().default(false),
});

export type EquipeMembro = {
  id: string;
  nome: string;
  role: "admin" | "corretor" | "corretor_vendas";
  tipo: "admin" | "executivo" | "corretor";
  executivo: string | null;
  responsavel_id: string | null;
};

export type LeadReuniaoOpt = { id: string; nome: string; telefone: string; etapa?: string | null };

type ProfileEquipeRow = { id: string; nome: string; responsavel_id: string | null; ativo?: boolean | null };
type RoleRow = { user_id: string; role: EquipeMembro["role"] };
type ResponsavelRow = { id: string; nome: string; ativo: boolean };

function firstName(nome: string) {
  return nome.trim().split(" ")[0]?.toLowerCase() ?? "";
}

async function loadMeetingAccess(supabaseAdmin: any, userId: string) {
  const [{ data: profiles }, { data: roles }, { data: resps }, { data: currentProfile }, { data: currentRole }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome, responsavel_id, ativo").eq("ativo", true).order("nome"),
    supabaseAdmin.from("user_roles").select("user_id, role"),
    supabaseAdmin.from("responsaveis").select("id, nome, ativo"),
    supabaseAdmin.from("profiles").select("id, nome, responsavel_id, ativo").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  const roleMap = new Map(((roles ?? []) as RoleRow[]).map((r) => [r.user_id, r.role]));
  const respRows = ((resps ?? []) as ResponsavelRow[]).filter((r) => r.ativo);
  const respMap = new Map(respRows.map((r) => [r.id, r.nome]));
  const execById = new Map(respRows.map((r) => [r.id, firstName(r.nome)]));
  const current = currentProfile as ProfileEquipeRow | null;
  const currentRoleName = ((currentRole?.role as EquipeMembro["role"] | undefined) ?? "corretor");
  const isAdmin = currentRoleName === "admin";
  const currentExecId = current?.responsavel_id && execById.get(current.responsavel_id) === firstName(current.nome)
    ? current.responsavel_id
    : null;
  const isExec = !isAdmin && !!currentExecId;

  const allEquipe: EquipeMembro[] = ((profiles ?? []) as ProfileEquipeRow[]).map((p) => {
    const role = roleMap.get(p.id) ?? "corretor";
    const isProfileExec = !!p.responsavel_id && execById.get(p.responsavel_id) === firstName(p.nome);
    const tipo: EquipeMembro["tipo"] = role === "admin" ? "admin" : isProfileExec ? "executivo" : "corretor";
    const executivo = tipo === "corretor" && p.responsavel_id ? respMap.get(p.responsavel_id) ?? null : null;
    return { id: p.id, nome: p.nome, role, tipo, executivo, responsavel_id: p.responsavel_id };
  });

  const equipe = isAdmin
    ? allEquipe
    : isExec
      ? allEquipe.filter((m) => m.tipo === "admin" || m.tipo === "executivo" || m.responsavel_id === currentExecId)
      : allEquipe.filter((m) => m.id === userId);

  return { isAdmin, isExec, currentExecId, currentRoleName, equipe };
}

export const listEquipeReuniao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { equipe } = await loadMeetingAccess(supabaseAdmin, context.userId);
    return { equipe };
  });

export const listLeadsReuniao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await loadMeetingAccess(supabaseAdmin, context.userId);
    let query = supabaseAdmin
      .from("leads")
      .select("id, nome, telefone, responsavel_id, etapa, is_corretor")
      .neq("etapa", "fechado")
      .eq("is_corretor", false)
      .order("nome")
      .limit(500);
    if (!access.isAdmin && access.currentExecId) query = query.eq("responsavel_id", access.currentExecId);
    if (!access.isAdmin && !access.currentExecId) return { leads: [] as LeadReuniaoOpt[] };
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { leads: ((data ?? []) as Array<LeadReuniaoOpt & { etapa?: string | null }>).map(({ id, nome, telefone, etapa }) => ({ id, nome, telefone, etapa: etapa ?? null })) };
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
      .select("lead_id, responsavel_id, user_id, added_by")
      .eq("reuniao_id", data.id);

    const partsArr = (parts ?? []) as { lead_id: string | null; responsavel_id: string | null; user_id: string | null; added_by: string | null }[];
    const leadIds = partsArr.map((p) => p.lead_id).filter(Boolean) as string[];
    const respIds = partsArr.map((p) => p.responsavel_id).filter(Boolean) as string[];
    const userIds = partsArr.map((p) => p.user_id).filter(Boolean) as string[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: leads }, { data: resps }, { data: usrs }, { data: roleRow }, { data: profile }] = await Promise.all([
      leadIds.length
        ? context.supabase.from("leads").select("id, nome, telefone").in("id", leadIds)
        : Promise.resolve({ data: [] as { id: string; nome: string; telefone: string }[] }),
      respIds.length
        ? context.supabase.from("responsaveis").select("id, nome, canal").in("id", respIds)
        : Promise.resolve({ data: [] as { id: string; nome: string; canal: string }[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, nome").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("profiles").select("responsavel_id").eq("id", context.userId).maybeSingle(),
    ]);

    const myRole = (roleRow?.role as string | undefined) ?? "corretor";
    const myResp = (profile?.responsavel_id as string | null | undefined) ?? null;
    const isExecutivo = !!myResp;

    let leadsList = (leads ?? []).map((l) => {
      const p = partsArr.find((x) => x.lead_id === l.id);
      return { ...l, added_by: p?.added_by ?? null };
    });

    if (myRole !== "admin" && isExecutivo) {
      leadsList = leadsList.filter((l) => l.added_by === context.userId);
    } else if (myRole !== "admin" && !isExecutivo) {
      leadsList = leadsList.filter((l) => l.added_by === context.userId);
    }

    return {
      ...(r as unknown as ReuniaoRow),
      participantes_leads: leadsList,
      participantes_corretores: resps ?? [],
      participantes_usuarios: (usrs ?? []) as { id: string; nome: string }[],
      my_role: myRole,
      my_user_id: context.userId,
      my_responsavel_id: myResp,
      is_executivo: isExecutivo,
    } as ReuniaoDetail;
  });

export const addLeadToReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reuniao_id: z.string().uuid(), lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Authorization: admin OR executivo who owns the lead via canal
    const [{ data: roleRow }, { data: profile }, { data: lead }, { data: reuniao }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("responsavel_id").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("leads").select("id, nome, telefone, canal, email").eq("id", data.lead_id).maybeSingle(),
      supabaseAdmin.from("reunioes" as never).select("id, titulo, data_inicio, local, tipo").eq("id", data.reuniao_id).maybeSingle(),
    ]);
    if (!lead) throw new Error("Lead não encontrado");
    if (!reuniao) throw new Error("Reunião não encontrada");
    const isAdmin = roleRow?.role === "admin";
    if (!isAdmin) {
      const respId = (profile?.responsavel_id as string | null) ?? null;
      if (!respId) throw new Error("Sem permissão");
      const { data: resp } = await supabaseAdmin.from("responsaveis").select("canal").eq("id", respId).maybeSingle();
      const meuCanal = (resp?.canal as string | null) ?? null;
      const leadCanal = (lead as { canal: string | null }).canal ?? null;
      if (!meuCanal || leadCanal !== meuCanal) throw new Error("Sem permissão sobre este lead");
    }

    // Idempotência
    const { data: existing } = await supabaseAdmin
      .from("reuniao_participantes" as never)
      .select("id")
      .eq("reuniao_id", data.reuniao_id)
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("reuniao_participantes" as never).insert({
        reuniao_id: data.reuniao_id,
        lead_id: data.lead_id,
        added_by: context.userId,
      } as never);
    }

    const r = reuniao as unknown as { titulo: string; data_inicio: string; local: string | null; tipo: string };
    const l = lead as unknown as { nome: string; telefone: string };
    return { ok: true, lead: l, reuniao: r };
  });

export const addLeadsBatchToReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    reuniao_id: z.string().uuid(),
    lead_ids: z.array(z.string().uuid()).min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roleRow }, { data: profile }, { data: reuniao }, { data: leadsRows }, { data: existingRows }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("responsavel_id").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("reunioes" as never).select("id, titulo, data_inicio, local, tipo").eq("id", data.reuniao_id).maybeSingle(),
      supabaseAdmin.from("leads").select("id, nome, telefone, canal").in("id", data.lead_ids),
      supabaseAdmin.from("reuniao_participantes" as never).select("lead_id").eq("reuniao_id", data.reuniao_id).not("lead_id", "is", null),
    ]);
    if (!reuniao) throw new Error("Reunião não encontrada");
    const isAdmin = roleRow?.role === "admin";
    let allowed = (leadsRows ?? []) as { id: string; nome: string; telefone: string; canal: string | null }[];
    if (!isAdmin) {
      const respId = (profile?.responsavel_id as string | null) ?? null;
      if (!respId) throw new Error("Sem permissão");
      const { data: resp } = await supabaseAdmin.from("responsaveis").select("canal").eq("id", respId).maybeSingle();
      const meuCanal = (resp?.canal as string | null) ?? null;
      if (!meuCanal) throw new Error("Sem permissão");
      allowed = allowed.filter((l) => l.canal === meuCanal);
    }
    const existingIds = new Set(((existingRows ?? []) as { lead_id: string }[]).map((r) => r.lead_id));
    const toInsert = allowed.filter((l) => !existingIds.has(l.id));
    if (toInsert.length) {
      await supabaseAdmin.from("reuniao_participantes" as never).insert(
        toInsert.map((l) => ({ reuniao_id: data.reuniao_id, lead_id: l.id, added_by: context.userId })) as never,
      );
    }
    const r = reuniao as unknown as { titulo: string; data_inicio: string; local: string | null; tipo: string };
    return { ok: true, reuniao: r, added: allowed };
  });

export const addUsersBatchToReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    reuniao_id: z.string().uuid(),
    user_ids: z.array(z.string().uuid()).min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleRow?.role !== "admin") throw new Error("Apenas Admin pode adicionar usuários internos");
    const { data: existingRows } = await supabaseAdmin
      .from("reuniao_participantes" as never)
      .select("user_id").eq("reuniao_id", data.reuniao_id).not("user_id", "is", null);
    const existingIds = new Set(((existingRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const toInsert = data.user_ids.filter((u) => !existingIds.has(u));
    if (toInsert.length) {
      await supabaseAdmin.from("reuniao_participantes" as never).insert(
        toInsert.map((uid) => ({ reuniao_id: data.reuniao_id, user_id: uid, added_by: context.userId })) as never,
      );
    }
    // Push para cada adicionado
    try {
      const appId = process.env.ONESIGNAL_APP_ID;
      const restKey = process.env.ONESIGNAL_REST_API_KEY;
      if (appId && restKey && toInsert.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles").select("id, onesignal_external_id").in("id", toInsert);
        const extIds = ((profs ?? []) as { onesignal_external_id: string | null }[])
          .map((p) => p.onesignal_external_id).filter((x): x is string => !!x);
        const { data: reuniao } = await supabaseAdmin
          .from("reunioes" as never).select("titulo, data_inicio").eq("id", data.reuniao_id).maybeSingle();
        const r = reuniao as unknown as { titulo: string; data_inicio: string } | null;
        if (extIds.length && r) {
          const dt = new Date(r.data_inicio);
          await fetch("https://api.onesignal.com/notifications?c=push", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Key ${restKey}` },
            body: JSON.stringify({
              app_id: appId,
              include_aliases: { external_id: extIds },
              target_channel: "push",
              headings: { en: "🟡 Você foi adicionado a uma reunião!" },
              contents: { en: `${r.titulo} — ${dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ${dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` },
              url: "https://iurirodriguesimoveiscrm.lovable.app/agenda",
            }),
          });
        }
      }
    } catch (e) {
      console.warn("[addUsersBatch] push falhou", e);
    }
    return { ok: true, addedCount: toInsert.length };
  });

export const addUserToReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reuniao_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleRow?.role !== "admin") throw new Error("Apenas Admin pode adicionar usuários internos");

    const [{ data: profAlvo }, { data: reuniao }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nome, onesignal_external_id").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin.from("reunioes" as never).select("id, titulo, data_inicio, local").eq("id", data.reuniao_id).maybeSingle(),
    ]);
    if (!profAlvo) throw new Error("Usuário não encontrado");
    if (!reuniao) throw new Error("Reunião não encontrada");

    const { data: existing } = await supabaseAdmin
      .from("reuniao_participantes" as never)
      .select("id").eq("reuniao_id", data.reuniao_id).eq("user_id", data.user_id).maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin.from("reuniao_participantes" as never).insert({
        reuniao_id: data.reuniao_id,
        user_id: data.user_id,
        added_by: context.userId,
      } as never);
      if (error) throw new Error(error.message);
    }

    // Push para o adicionado
    try {
      const appId = process.env.ONESIGNAL_APP_ID;
      const restKey = process.env.ONESIGNAL_REST_API_KEY;
      const extId = (profAlvo as { onesignal_external_id: string | null }).onesignal_external_id;
      const r = reuniao as unknown as { titulo: string; data_inicio: string; local: string | null };
      if (appId && restKey && extId) {
        const dt = new Date(r.data_inicio);
        const dataStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const horaStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        await fetch("https://api.onesignal.com/notifications?c=push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Key ${restKey}` },
          body: JSON.stringify({
            app_id: appId,
            include_aliases: { external_id: [extId] },
            target_channel: "push",
            headings: { en: "🟡 Você foi adicionado a uma reunião!" },
            contents: { en: `${r.titulo} — ${dataStr} às ${horaStr}` },
            url: "https://iurirodriguesimoveiscrm.lovable.app/agenda",
          }),
        });
      }
    } catch (e) {
      console.warn("[addUserToReuniao] push falhou", e);
    }

    return { ok: true, user: { id: profAlvo.id, nome: (profAlvo as { nome: string }).nome } };
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

    const access = await loadMeetingAccess(supabaseAdmin, context.userId);
    if (!access.isAdmin && !access.isExec) throw new Error("Apenas Admin ou Executivo pode criar reunião");
    const allowedUserIds = new Set(access.equipe.map((m) => m.id));
    const selectedUserIds = data.user_ids.filter((id) => allowedUserIds.has(id));
    const autoUserIds = access.equipe.filter((m) => m.tipo === "admin" || m.tipo === "executivo").map((m) => m.id);
    const allUserIds = Array.from(new Set([...selectedUserIds, ...autoUserIds]));
    const pushUserIds = access.equipe
      .filter((m) => m.tipo === "corretor" && selectedUserIds.includes(m.id))
      .map((m) => m.id);

    // Participantes
    const rows: { reuniao_id: string; lead_id: string | null; responsavel_id: string | null; user_id: string | null; added_by: string | null }[] = [
      ...data.lead_ids.map((lid) => ({ reuniao_id: reuniaoId, lead_id: lid, responsavel_id: null, user_id: null, added_by: context.userId })),
      ...data.responsavel_ids.map((rid) => ({ reuniao_id: reuniaoId, lead_id: null, responsavel_id: rid, user_id: null, added_by: context.userId })),
      ...allUserIds.map((uid) => ({ reuniao_id: reuniaoId, lead_id: null, responsavel_id: null, user_id: uid, added_by: context.userId })),
    ];
    if (rows.length) {
      await supabaseAdmin.from("reuniao_participantes" as never).insert(rows as never);
    }

    // Google Meet + convite por email aos leads
    let finalLocal = data.local ?? null;
    let invitedEmails: string[] = [];
    let leadsSemEmail: string[] = [];
    if (data.usar_meet) {
      try {
        const { createCalendarEventWithMeet } = await import("@/lib/google.server");
        const [{ data: profilesRows }, { data: leadsRows }, { data: creatorProfile }, { data: respRows }] = await Promise.all([
          data.responsavel_ids.length
            ? supabaseAdmin
                .from("profiles")
                .select("id, responsavel_id")
                .in("responsavel_id", data.responsavel_ids)
            : Promise.resolve({ data: [] as { id: string; responsavel_id: string }[] }),
          data.lead_ids.length
            ? supabaseAdmin.from("leads").select("nome, email").in("id", data.lead_ids)
            : Promise.resolve({ data: [] as { nome: string; email: string | null }[] }),
          supabaseAdmin.from("profiles").select("nome").eq("id", context.userId).maybeSingle(),
          data.responsavel_ids.length
            ? supabaseAdmin.from("responsaveis").select("nome").in("id", data.responsavel_ids)
            : Promise.resolve({ data: [] as { nome: string }[] }),
        ]);
        const leadList = (leadsRows ?? []) as { nome: string; email: string | null }[];
        invitedEmails = leadList
          .map((l) => l.email)
          .filter((e): e is string => !!e && /.+@.+\..+/.test(e));
        leadsSemEmail = leadList.filter((l) => !l.email || !/.+@.+\..+/.test(l.email)).map((l) => l.nome);

        const corretorNome =
          ((respRows ?? []) as { nome: string }[]).map((r) => r.nome).join(", ") ||
          (creatorProfile?.nome ?? "Equipe Iuri Rodrigues");

        const dt = new Date(data.data_inicio);
        const dataBR = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const horaBR = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        const isInstitucional = data.tipo === "institucional";
        const summary = isInstitucional
          ? "Reunião Institucional - Iuri Rodrigues Imóveis"
          : "Reunião - Iuri Rodrigues Imóveis";

        const buildDescription = (meetLink: string | null) => {
          const header = isInstitucional
            ? `Olá!\n\nSua reunião INSTITUCIONAL foi confirmada com a Iuri Rodrigues Imóveis.\nCom nosso Diretor Geral IURI RODRIGUES.`
            : `Olá!\n\nSua reunião foi confirmada com a Iuri Rodrigues Imóveis.`;
          const link = meetLink ?? "(disponível no convite)";
          return `${header}\n\n👤 Corretor: ${corretorNome}\n📅 Data: ${dataBR}\n🕐 Hora: ${horaBR}\n📍 Link Google Meet: ${link}\n\nQualquer dúvida entre em contato!\nIuri Rodrigues Imóveis 🏢`;
        };

        const userIds = Array.from(new Set([
          context.userId,
          ...((profilesRows ?? []) as { id: string; responsavel_id: string }[]).map((p) => p.id),
          ...allUserIds,
        ]));
        let primaryMeetLink: string | null = null;
        let primaryEventId: string | null = null;
        let primaryUserId: string | null = null;
        const eventRefs: { user_id: string; event_id: string }[] = [];
        for (const uid of userIds) {
          const isPrimary = !primaryMeetLink;
          const ev = await createCalendarEventWithMeet({
            userId: uid,
            summary,
            description: buildDescription(null),
            startISO: data.data_inicio,
            durationMin: data.duracao_min,
            attendeesEmails: isPrimary ? invitedEmails : [],
          });
          if (ev?.eventId) eventRefs.push({ user_id: uid, event_id: ev.eventId });
          if (ev?.meetLink && !primaryMeetLink) {
            primaryMeetLink = ev.meetLink;
            primaryEventId = ev.eventId;
            primaryUserId = uid;
          }
        }
        if (primaryMeetLink) {
          finalLocal = primaryMeetLink;
          if (primaryEventId && primaryUserId) {
            try {
              const { patchCalendarEventDescription } = await import("@/lib/google.server");
              await patchCalendarEventDescription({
                userId: primaryUserId,
                eventId: primaryEventId,
                description: buildDescription(primaryMeetLink),
              });
            } catch (e) {
              console.warn("[Reuniao] patch descricao falhou", e);
            }
          }
          await supabaseAdmin
            .from("reunioes" as never)
            .update({ local: primaryMeetLink, google_event_ids: eventRefs } as never)
            .eq("id", reuniaoId);
        } else {
          if (eventRefs.length) {
            await supabaseAdmin
              .from("reunioes" as never)
              .update({ google_event_ids: eventRefs } as never)
              .eq("id", reuniaoId);
          }
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

    // Notificação push apenas para corretores adicionados explicitamente
    try {
      const { sendOneSignalPush } = await import("@/lib/onesignal.server");
      const { data: perfisPush } = pushUserIds.length
        ? await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", pushUserIds)
        : { data: [] };
      const externalIds = ((perfisPush ?? []) as { onesignal_external_id: string | null }[])
        .map((p) => p.onesignal_external_id)
        .filter((id): id is string => !!id);

      const dt = new Date(data.data_inicio);
      const dataStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
      const horaStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      const url = `https://iurirodriguesimoveiscrm.lovable.app/agenda`;

      if (externalIds.length) {
        await sendOneSignalPush({
          externalIds,
          title: "📅 Você foi adicionado a uma reunião",
          message: `${data.titulo} | ${dataStr} às ${horaStr}`,
          url,
          data: { reuniao_id: reuniaoId },
        });
      }
    } catch (e) {
      console.error("[Reuniao] push falhou", e);
    }

    try {
      if (data.lead_ids.length) {
        const { sendZapiMessage } = await import("@/lib/notify.server");
        const { data: leadsZap } = await supabaseAdmin.from("leads").select("nome, telefone").in("id", data.lead_ids);
        const dt = new Date(data.data_inicio);
        const dataStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const horaStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        for (const lead of (leadsZap ?? []) as { nome: string; telefone: string }[]) {
          const phone = lead.telefone.replace(/\D+/g, "");
          if (!phone) continue;
          await sendZapiMessage(phone.startsWith("55") ? phone : `55${phone}`, `Olá ${lead.nome}! Sua reunião foi confirmada para ${dataStr} às ${horaStr}. Link: ${finalLocal ?? "a definir"}`);
        }
      }
    } catch (e) {
      console.error("[Reuniao] WhatsApp lead falhou", e);
    }

    return { id: reuniaoId, local: finalLocal, invitedEmails, leadsSemEmail };
  });

async function cancelMeetingSideEffects(reuniaoId: string, criadoPorUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("reunioes" as never)
    .select("*")
    .eq("id", reuniaoId)
    .maybeSingle();
  if (!row) return;
  const r = row as unknown as ReuniaoRow & { google_event_ids?: { user_id: string; event_id: string }[] };

  // Delete Google Calendar events for every participant we know about
  const refs = Array.isArray(r.google_event_ids) ? r.google_event_ids : [];
  if (refs.length) {
    try {
      const { deleteCalendarEvent } = await import("@/lib/google.server");
      for (const ref of refs) {
        const ok = await deleteCalendarEvent({ userId: ref.user_id, eventId: ref.event_id });
        if (!ok) console.warn("[Reuniao] falha ao remover evento Calendar", ref);
      }
    } catch (e) {
      console.error("[Reuniao] erro ao remover eventos Calendar", e);
    }
  }

  // Push notification to all
  try {
    const { sendOneSignalPush } = await import("@/lib/onesignal.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("nome").eq("id", criadoPorUserId).maybeSingle();
    const nome = prof?.nome ?? "Sistema";
    const dt = new Date(r.data_inicio);
    const dataStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    const horaStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    await sendOneSignalPush({
      segments: ["All"],
      title: "❌ Reunião Cancelada",
      message: `A reunião de ${dataStr} às ${horaStr} foi cancelada por ${nome}`,
      url: "https://iurirodriguesimoveiscrm.lovable.app/agenda",
      data: { reuniao_id: reuniaoId },
    });
  } catch (e) {
    console.error("[Reuniao] push cancelamento falhou", e);
  }
}

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
    if (data.status === "cancelada") {
      await cancelMeetingSideEffects(data.id, context.userId);
    }
    return { ok: true };
  });

export const deleteReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Run side effects (calendar delete + push) before removing the row
    await cancelMeetingSideEffects(data.id, context.userId);
    const { error } = await context.supabase.from("reunioes" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
