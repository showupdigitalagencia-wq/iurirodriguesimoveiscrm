import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FinanciamentoStatus = "pendente" | "em_analise" | "aprovado" | "recusado";

export type FinanciamentoRow = {
  id: string;
  lead_id: string | null;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  estado_civil: string | null;
  renda_mensal: number | null;
  profissao: string | null;
  imovel_endereco: string | null;
  imovel_valor: number | null;
  rg_path: string | null;
  cpf_path: string | null;
  comp_renda_path: string | null;
  comp_residencia_path: string | null;
  extrato_path: string | null;
  status: FinanciamentoStatus;
  observacao: string | null;
  criado_por: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const fileSchema = z
  .object({
    nome: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(150),
    base64: z.string().min(1),
  })
  .optional();

// ============================================================
// 1. PRÉ-PREENCHIMENTO (público) — busca nome/telefone do lead
// ============================================================
export const getLeadParaFinanciamento = createServerFn({ method: "POST" })
  .inputValidator((input: { leadId: string }) =>
    z.object({ leadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("vendas_leads")
      .select("id, nome, telefone, email")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) return { lead: null };
    const l = lead as { id: string; nome: string; telefone: string; email: string | null };
    return { lead: { id: l.id, nome: l.nome, telefone: l.telefone, email: l.email } };
  });

// ============================================================
// 2. SUBMISSÃO PÚBLICA (sem login) — /financiamento
// ============================================================
export const submeterFinanciamento = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      leadId?: string | null;
      nome: string;
      cpf: string;
      telefone: string;
      email?: string;
      estado_civil?: string;
      renda_mensal?: number;
      profissao?: string;
      imovel_endereco?: string;
      imovel_valor?: number;
      arquivos: {
        rg?: { nome: string; mimeType: string; base64: string };
        cpf?: { nome: string; mimeType: string; base64: string };
        comp_renda?: { nome: string; mimeType: string; base64: string };
        comp_residencia?: { nome: string; mimeType: string; base64: string };
        extrato?: { nome: string; mimeType: string; base64: string };
      };
    }) =>
      z
        .object({
          leadId: z.string().uuid().nullable().optional(),
          nome: z.string().trim().min(3).max(150),
          cpf: z.string().trim().min(11).max(20),
          telefone: z.string().trim().min(10).max(20),
          email: z.string().trim().email().max(255).optional().or(z.literal("")),
          estado_civil: z.string().trim().max(50).optional().or(z.literal("")),
          renda_mensal: z.number().nonnegative().optional(),
          profissao: z.string().trim().max(150).optional().or(z.literal("")),
          imovel_endereco: z.string().trim().max(500).optional().or(z.literal("")),
          imovel_valor: z.number().nonnegative().optional(),
          arquivos: z.object({
            rg: fileSchema,
            cpf: fileSchema,
            comp_renda: fileSchema,
            comp_residencia: fileSchema,
            extrato: fileSchema,
          }),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tempId = crypto.randomUUID();
    const basePath = tempId;

    async function uploadOne(
      slot: "rg" | "cpf" | "comp_renda" | "comp_residencia" | "extrato",
      file: { nome: string; mimeType: string; base64: string } | undefined,
    ): Promise<string | null> {
      if (!file) return null;
      const bin = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const safeName = file.nome.replace(/[^\w.\-]/g, "_");
      const path = `${basePath}/${slot}-${safeName}`;
      const { error } = await supabaseAdmin.storage
        .from("financiamento-docs")
        .upload(path, bin, { contentType: file.mimeType, upsert: false });
      if (error) throw new Error(`Falha no upload ${slot}: ${error.message}`);
      return path;
    }

    const [rgPath, cpfPath, rendaPath, residPath, extratoPath] = await Promise.all([
      uploadOne("rg", data.arquivos.rg),
      uploadOne("cpf", data.arquivos.cpf),
      uploadOne("comp_renda", data.arquivos.comp_renda),
      uploadOne("comp_residencia", data.arquivos.comp_residencia),
      uploadOne("extrato", data.arquivos.extrato),
    ]);

    const { data: ins, error } = await supabaseAdmin
      .from("financiamentos" as never)
      .insert({
        lead_id: data.leadId || null,
        nome: data.nome,
        cpf: data.cpf.replace(/\D/g, ""),
        telefone: data.telefone.replace(/\D/g, ""),
        email: data.email || null,
        estado_civil: data.estado_civil || null,
        renda_mensal: data.renda_mensal ?? null,
        profissao: data.profissao || null,
        imovel_endereco: data.imovel_endereco || null,
        imovel_valor: data.imovel_valor ?? null,
        rg_path: rgPath,
        cpf_path: cpfPath,
        comp_renda_path: rendaPath,
        comp_residencia_path: residPath,
        extrato_path: extratoPath,
        status: "pendente",
      } as never)
      .select("id")
      .maybeSingle();
    if (error || !ins) throw new Error(error?.message || "Falha ao registrar financiamento");

    return { ok: true, financiamentoId: (ins as { id: string }).id };
  });

// ============================================================
// 3. LISTAR (admin ou correspondente)
// ============================================================
async function assertCanManage(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isCorresp }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_correspondente_bancaria", { _user_id: userId }),
  ]);
  if (isAdmin !== true && isCorresp !== true) throw new Error("Forbidden");
}

export const listFinanciamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: FinanciamentoStatus | "todos" }) =>
    z
      .object({
        status: z.enum(["pendente", "em_analise", "aprovado", "recusado", "todos"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("financiamentos" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "todos") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { financiamentos: (rows ?? []) as unknown as FinanciamentoRow[] };
  });

// ============================================================
// 4. DETALHE + SIGNED URLS
// ============================================================
export const getFinanciamentoDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("financiamentos" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Financiamento não encontrado");
    const r = row as unknown as FinanciamentoRow;

    async function sign(p: string | null) {
      if (!p) return null;
      const { data: s } = await supabaseAdmin.storage
        .from("financiamento-docs")
        .createSignedUrl(p, 60 * 30);
      return s?.signedUrl ?? null;
    }
    const urls = {
      rg: await sign(r.rg_path),
      cpf: await sign(r.cpf_path),
      comp_renda: await sign(r.comp_renda_path),
      comp_residencia: await sign(r.comp_residencia_path),
      extrato: await sign(r.extrato_path),
    };
    try {
      await context.supabase.rpc("log_audit" as never, {
        _acao: "financiamento_documentos_view",
        _tabela: "financiamentos",
        _registro_id: data.id,
        _antes: null,
        _depois: null,
        _contexto: { nome: r.nome, cpf_mask: r.cpf?.slice(-4) ?? null, lead_id: r.lead_id },
      } as never);
    } catch (e) { console.warn("[audit doc_view]", e); }
    return { financiamento: r, urls };
  });


// ============================================================
// 5. ATUALIZAR STATUS
// ============================================================
export const updateFinanciamentoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; status: FinanciamentoStatus; observacao?: string }) =>
      z
        .object({
          id: z.string().uuid(),
          status: z.enum(["pendente", "em_analise", "aprovado", "recusado"]),
          observacao: z.string().trim().max(2000).optional().or(z.literal("")),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prev } = await supabaseAdmin
      .from("financiamentos" as never)
      .select("status, lead_id, nome")
      .eq("id", data.id)
      .maybeSingle();
    const prevRow = prev as { status: FinanciamentoStatus; lead_id: string | null; nome: string } | null;

    const { error } = await supabaseAdmin
      .from("financiamentos" as never)
      .update({
        status: data.status,
        observacao: data.observacao || null,
        updated_by: context.userId,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Auditoria: status do financiamento
    try {
      await context.supabase.rpc("log_audit" as never, {
        _acao: "financiamento_status_change",
        _tabela: "financiamentos",
        _registro_id: data.id,
        _antes: prevRow ? { status: prevRow.status } : null,
        _depois: { status: data.status, observacao: data.observacao || null },
        _contexto: { lead_id: prevRow?.lead_id ?? null, nome: prevRow?.nome ?? null },
      } as never);
    } catch (e) { console.warn("[audit financiamento_status]", e); }


    // Push para executivo responsável + corretor + admins quando aprovado/recusado
    const statusMudou = prevRow && prevRow.status !== data.status;
    const ehFinal = data.status === "aprovado" || data.status === "recusado";
    if (statusMudou && ehFinal && prevRow) {
      try {
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");
        const destinatariosIds = new Set<string>();

        if (prevRow.lead_id) {
          const { data: leadRow } = await supabaseAdmin
            .from("vendas_leads")
            .select("atribuido_por, corretor_id")
            .eq("id", prevRow.lead_id)
            .maybeSingle();
          const lr = leadRow as { atribuido_por: string | null; corretor_id: string | null } | null;
          if (lr?.atribuido_por) destinatariosIds.add(lr.atribuido_por);
          if (lr?.corretor_id) destinatariosIds.add(lr.corretor_id);
        }

        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        ((admins ?? []) as { user_id: string }[]).forEach((a) => destinatariosIds.add(a.user_id));

        if (destinatariosIds.size > 0) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("onesignal_external_id")
            .in("id", Array.from(destinatariosIds));
          const externalIds = ((profs ?? []) as { onesignal_external_id: string | null }[])
            .map((p) => p.onesignal_external_id)
            .filter((x): x is string => !!x);

          if (externalIds.length > 0) {
            const aprovado = data.status === "aprovado";
            const title = aprovado ? "Financiamento aprovado" : "Financiamento recusado";
            const obs = data.observacao ? ` — ${data.observacao}` : "";
            const message = `${prevRow.nome}: ${aprovado ? "aprovado" : "recusado"} pela correspondente${obs}`;
            await sendOneSignalPush({
              externalIds,
              title,
              message,
              url: `https://sistemanexus.app/correspondente?open=${data.id}`,
              data: { financiamento_id: data.id, status: data.status },
            });
          }
        }
      } catch (e) {
        console.warn("[updateFinanciamentoStatus] push falhou", e);
      }
    }

    return { ok: true };
  });

// ============================================================
// 6. Status do financiamento de um lead (para badge no card)
// ============================================================
export const getFinanciamentoStatusByLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) =>
    z.object({ leadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("financiamentos")
      .select("id, status, observacao, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: null as FinanciamentoStatus | null, observacao: null as string | null };
    if (!row) return { status: null, observacao: null };
    const r = row as { status: FinanciamentoStatus; observacao: string | null };
    return { status: r.status, observacao: r.observacao };
  });

// ============================================================
// 7. EXCLUIR financiamento (admin ou correspondente)
//    Remove storage + linha. NÃO mexe no lead de vendas.
// ============================================================
export const deleteFinanciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: selErr } = await supabaseAdmin
      .from("financiamentos" as never)
      .select("id, rg_path, cpf_path, comp_renda_path, comp_residencia_path, extrato_path")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Financiamento não encontrado");
    const r = row as {
      rg_path: string | null; cpf_path: string | null;
      comp_renda_path: string | null; comp_residencia_path: string | null;
      extrato_path: string | null;
    };

    const paths = [r.rg_path, r.cpf_path, r.comp_renda_path, r.comp_residencia_path, r.extrato_path]
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { error: rmErr } = await supabaseAdmin.storage.from("financiamento-docs").remove(paths);
      if (rmErr) console.warn("[deleteFinanciamento] remove storage falhou", rmErr.message);
    }

    try {
      await context.supabase.rpc("log_audit" as never, {
        _acao: "financiamento_delete",
        _tabela: "financiamentos",
        _registro_id: data.id,
        _antes: r as never,
        _depois: null,
        _contexto: { storage_paths_removidos: paths.length },
      } as never);
    } catch (e) { console.warn("[audit financiamento_delete]", e); }

    const { error: delErr } = await supabaseAdmin
      .from("financiamentos" as never)
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });

