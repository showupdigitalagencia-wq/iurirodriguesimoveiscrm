import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EscalaRow = { id: string; data: string; corretor_id: string; corretor_nome: string | null };

async function ensureAdminOrExec(ctx: { supabase: ReturnType<typeof Object>; userId: string }) {
  const [{ data: isAdmin }, { data: isExec }] = await Promise.all([
    (ctx.supabase as { rpc: (n: string, a: unknown) => Promise<{ data: boolean | null }> })
      .rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    (ctx.supabase as { rpc: (n: string) => Promise<{ data: boolean | null }> })
      .rpc("current_user_is_executivo"),
  ]);
  if (!isAdmin && !isExec) throw new Error("Acesso negado");
}

export const getEscalaMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inicio = `${data.ano}-${String(data.mes).padStart(2, "0")}-01`;
    const fim = new Date(data.ano, data.mes, 1).toISOString().slice(0, 10);
    const { data: rows, error } = await supabaseAdmin
      .from("plantao_escala" as never)
      .select("id, data, corretor_id")
      .gte("data", inicio).lt("data", fim);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as { id: string; data: string; corretor_id: string }[];
    const ids = Array.from(new Set(list.map((r) => r.corretor_id)));
    let nomes = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", ids);
      nomes = new Map((profs ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
    }
    void context;
    return { items: list.map((r) => ({ ...r, corretor_nome: nomes.get(r.corretor_id) ?? null })) as EscalaRow[] };
  });

export const setPlantonista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), corretor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdminOrExec(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // upsert por data
    const { error } = await supabaseAdmin
      .from("plantao_escala" as never)
      .upsert({ data: data.data, corretor_id: data.corretor_id, criado_por: context.userId } as never, { onConflict: "data" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerPlantonista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdminOrExec(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("plantao_escala" as never).delete().eq("data", data.data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCorretoresElegiveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdminOrExec(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // corretor_vendas + corretor (legado) + executivos
    const [{ data: roles }, { data: execs }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["corretor_vendas", "corretor"]),
      supabaseAdmin.from("profiles")
        .select("id, nome, responsavel_id, ativo, responsaveis:responsavel_id(id, nome, ativo)")
        .not("responsavel_id", "is", null),
    ]);
    const ids = new Set<string>((roles ?? []).map((r: { user_id: string }) => r.user_id));
    for (const p of (execs ?? []) as { id: string; nome: string; ativo: boolean | null; responsaveis: { nome: string; ativo: boolean | null } | null }[]) {
      const resp = p.responsaveis;
      if (!resp || resp.ativo === false || p.ativo === false) continue;
      if ((resp.nome ?? "").trim().split(/\s+/)[0]?.toLowerCase() === (p.nome ?? "").trim().split(/\s+/)[0]?.toLowerCase()) {
        ids.add(p.id);
      }
    }
    if (!ids.size) return { items: [] as { id: string; nome: string }[] };
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome, ativo").in("id", Array.from(ids));
    const items = ((profs ?? []) as { id: string; nome: string; ativo: boolean | null }[])
      .filter((p) => p.ativo !== false)
      .map((p) => ({ id: p.id, nome: p.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { items };
  });

export const getPlantonistaHoje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: esc } = await supabaseAdmin
      .from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
    const corretorId = (esc as { corretor_id: string } | null)?.corretor_id ?? null;
    if (!corretorId) return { data: hoje, corretor_id: null, corretor_nome: null };
    const { data: p } = await supabaseAdmin.from("profiles").select("nome").eq("id", corretorId).maybeSingle();
    return { data: hoje, corretor_id: corretorId, corretor_nome: (p as { nome: string } | null)?.nome ?? null };
  });

export const getMeusLeadsPlantao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("vendas_leads")
      .select("id, atribuicao_status")
      .eq("corretor_id", context.userId)
      .eq("plantao_dia" as never, hoje);
    const list = (rows ?? []) as { id: string; atribuicao_status: string | null }[];
    return {
      total: list.length,
      aceitos: list.filter((l) => l.atribuicao_status === "aceito").length,
      pendentes: list.filter((l) => l.atribuicao_status === "pendente").length,
    };
  });
