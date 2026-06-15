import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const Role = z.enum(["admin", "corretor", "corretor_vendas"]);

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (authErr) throw new Error(authErr.message);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, nome, ativo, responsavel_id, vendas_acesso");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

    return authData.users.map((u) => {
      const p = profileMap.get(u.id) as { nome?: string; ativo?: boolean; responsavel_id?: string | null; vendas_acesso?: boolean } | undefined;
      return {
        id: u.id,
        email: u.email ?? "",
        nome: p?.nome ?? "",
        ativo: p?.ativo ?? true,
        responsavel_id: p?.responsavel_id ?? null,
        vendas_acesso: p?.vendas_acesso ?? false,
        role: roleMap.get(u.id) ?? "corretor",
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      };
    });
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(6).max(128),
    role: Role,
    responsavel_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

    // Trigger cria profile + role default (corretor). Atualizamos se necessário.
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id, nome: data.nome, responsavel_id: data.responsavel_id ?? null,
    });

    if (data.role !== "corretor") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    }

    return { ok: true, id: created.user.id };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    role: Role.optional(),
    responsavel_id: z.string().uuid().nullable().optional(),
    ativo: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const profilePatch: { nome?: string; responsavel_id?: string | null; ativo?: boolean } = {};
    if (data.nome !== undefined) profilePatch.nome = data.nome;
    if (data.responsavel_id !== undefined) profilePatch.responsavel_id = data.responsavel_id;
    if (data.ativo !== undefined) profilePatch.ativo = data.ativo;
    if (Object.keys(profilePatch).length) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.id);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    }

    // Desativar = banir login no Auth; reativar = remover ban
    if (data.ativo !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(data.id, {
        ban_duration: data.ativo ? "none" : "876000h",
      });
    }

    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    password: z.string().min(6).max(128),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    if (data.id === context.userId) throw new Error("Você não pode excluir sua própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    return { role: (data?.role as "admin" | "corretor" | "corretor_vendas" | undefined) ?? "corretor" };
  });
