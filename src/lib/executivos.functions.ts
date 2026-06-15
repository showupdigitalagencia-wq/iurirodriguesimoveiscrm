import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const listExecutivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: execs } = await supabaseAdmin
      .from("responsaveis")
      .select("id, nome, canal, whatsapp, ativo, regiao")
      .order("nome");

    // Equipe fechada = leads do recrutamento já contratados (is_corretor + fechado)
    const { data: contratados } = await supabaseAdmin
      .from("leads")
      .select("responsavel_id")
      .eq("is_corretor", true)
      .eq("etapa", "fechado");

    // Leads no pipeline = todos os leads do executivo, exceto corretores já contratados
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("responsavel_id, etapa, is_corretor");

    const corretoresAtivosCount = new Map<string, number>();
    (contratados ?? []).forEach((c) => {
      if (c.responsavel_id) corretoresAtivosCount.set(c.responsavel_id, (corretoresAtivosCount.get(c.responsavel_id) ?? 0) + 1);
    });

    const leadsCount = new Map<string, number>();
    (leads ?? []).forEach((l) => {
      if (!l.responsavel_id) return;
      if (l.is_corretor && l.etapa === "fechado") return;
      leadsCount.set(l.responsavel_id, (leadsCount.get(l.responsavel_id) ?? 0) + 1);
    });

    return (execs ?? []).map((e) => ({
      ...e,
      total_corretores: corretoresAtivosCount.get(e.id) ?? 0,
      leads_ativos: leadsCount.get(e.id) ?? 0,
    }));
  });

export const getExecutivoDetalhe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: exec } = await supabaseAdmin
      .from("responsaveis")
      .select("id, nome, canal, whatsapp, ativo, regiao")
      .eq("id", data.id)
      .maybeSingle();
    if (!exec) throw new Error("Executivo não encontrado");

    // Equipe ativa = leads de recrutamento já fechados/contratados
    const { data: contratados } = await supabaseAdmin
      .from("leads")
      .select("id, nome, telefone, regiao, email")
      .eq("responsavel_id", data.id)
      .eq("is_corretor", true)
      .eq("etapa", "fechado")
      .order("nome");

    // Cruza com profiles via email para descobrir status ativo/inativo e profile_id
    const emails = (contratados ?? []).map((c) => c.email).filter(Boolean) as string[];
    const statusByEmail = new Map<string, { profileId: string; ativo: boolean }>();
    if (emails.length) {
      try {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const matched = (users?.users ?? []).filter((u) => u.email && emails.includes(u.email)).map((u) => ({ id: u.id, email: u.email! }));
        if (matched.length) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("id, ativo")
            .in("id", matched.map((p) => p.id));
          const ativoById = new Map((profs ?? []).map((p) => [p.id, p.ativo]));
          matched.forEach((p) => statusByEmail.set(p.email, { profileId: p.id, ativo: ativoById.get(p.id) ?? true }));
        }
      } catch {
        // sem acesso
      }
    }

    const todos = (contratados ?? []).map((c) => {
      const info = c.email ? statusByEmail.get(c.email) : undefined;
      return {
        id: c.id,
        profile_id: info?.profileId ?? null,
        nome: c.nome,
        telefone: c.telefone,
        regiao: c.regiao as string,
        ativo: info?.ativo ?? true,
      };
    });

    // Mostrar APENAS corretores ativos
    const corretores = todos.filter((c) => c.ativo);

    return {
      executivo: exec,
      corretores,
      equipeStats: { total: todos.length, ativos: corretores.length },
    };
  });

export const setCorretorAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ profile_id: z.string().uuid(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCorretoresDisponiveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["corretor", "corretor_vendas"]);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, ativo, responsavel_id")
      .in("id", ids)
      .order("nome");

    const { data: execs } = await supabaseAdmin.from("responsaveis").select("id, nome");
    const execMap = new Map((execs ?? []).map((e) => [e.id, e.nome]));

    return (profiles ?? []).map((p) => ({
      ...p,
      executivo_nome: p.responsavel_id ? execMap.get(p.responsavel_id) ?? null : null,
    }));
  });

export const setCorretorExecutivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    corretor_id: z.string().uuid(),
    executivo_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ responsavel_id: data.executivo_id })
      .eq("id", data.corretor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateExecutivoRegiao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    regiao: z.string().trim().max(200).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("responsaveis")
      .update({ regiao: data.regiao })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function slugifyCanal(nome: string) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `exec_${Date.now().toString(36)}`;
}

export const createExecutivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(6).max(128),
    whatsapp: z.string().trim().min(8).max(40),
    regiao: z.string().trim().min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let canal = slugifyCanal(data.nome);
    const { data: existing } = await supabaseAdmin.from("responsaveis").select("canal");
    const taken = new Set((existing ?? []).map((r) => r.canal as string));
    let suffix = 1;
    let candidate = canal;
    while (taken.has(candidate)) {
      suffix += 1;
      candidate = `${canal}_${suffix}`.slice(0, 40);
    }
    canal = candidate;
    const { error: enumErr } = await supabaseAdmin.rpc("add_lead_canal_value", { _value: canal });
    if (enumErr) throw new Error(`Falha ao registrar canal: ${enumErr.message}`);

    const { data: resp, error: respErr } = await supabaseAdmin
      .from("responsaveis")
      .insert({ nome: data.nome, canal: canal as never, whatsapp: data.whatsapp, regiao: data.regiao, ativo: true })
      .select("id")
      .single();
    if (respErr || !resp) throw new Error(respErr?.message ?? "Falha ao criar executivo");

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (userErr || !created.user) {
      await supabaseAdmin.from("responsaveis").delete().eq("id", resp.id);
      throw new Error(userErr?.message ?? "Falha ao criar usuário");
    }

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      nome: data.nome,
      responsavel_id: resp.id,
      ativo: true,
    });

    return { ok: true, id: resp.id };
  });
