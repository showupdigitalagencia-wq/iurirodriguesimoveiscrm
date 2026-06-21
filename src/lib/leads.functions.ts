import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LeadEtapa = z.enum([
  "novos_leads", "em_atendimento", "reuniao_agendada",
  "solicitacao_documentos", "documentos_enviados", "em_negociacao", "follow_up", "fechado", "descartado", "descredenciado",
]);

export const updateLeadEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), etapa: LeadEtapa }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: { etapa: typeof data.etapa; fechado_em?: string } = { etapa: data.etapa };
    if (data.etapa === "fechado" || data.etapa === "descartado") {
      patch.fechado_em = new Date().toISOString();
    }
    const { error } = await context.supabase.from("leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("lead_historico").insert({
      lead_id: data.id, user_id: context.userId, acao: "mudou_etapa",
      detalhe: { etapa: data.etapa } as never,
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
      nome: z.string().min(1).max(200).optional(),
      email: z.string().email().max(255).nullable().optional(),
      telefone: z.string().min(1).max(40).optional(),
      observacoes: z.string().max(5000).nullable().optional(),
      canal: z.enum(["denise", "fabiola", "renata", "robson"]).optional(),
      responsavel_id: z.string().uuid().nullable().optional(),
      motivo_perda: z.string().max(2000).nullable().optional(),
      regiao: z.string().min(1).max(60).optional(),
      etapa: LeadEtapa.optional(),
      dados_corretor: z.record(z.string(), z.string().nullable()).nullable().optional(),
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch = { ...data.patch } as Record<string, unknown>;
    if (data.patch.etapa === "fechado" || data.patch.etapa === "descartado") {
      patch.fechado_em = new Date().toISOString();
    }
    const { error } = await context.supabase.from("leads").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("lead_historico").insert({
      lead_id: data.id, user_id: context.userId, acao: "editou_lead",
      detalhe: data.patch as never,
    });
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid(), nota: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_historico").insert({
      lead_id: data.lead_id, user_id: context.userId, acao: "nota",
      detalhe: { nota: data.nota } as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const descredenciarCorretor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    lead_id: z.string().uuid(),
    motivo: z.string().trim().min(3, "Motivo obrigatório (mín. 3 caracteres)").max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Só admin pode descredenciar
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem descredenciar.");

    // 2) Buscar lead e validar que está em 'fechado'
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, nome, email, etapa, regiao, responsavel_id")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.etapa !== "fechado") {
      throw new Error("Só é possível descredenciar corretores que estão na etapa 'Fechado'.");
    }

    const nowIso = new Date().toISOString();

    // 3) Atualizar lead → descredenciado
    const { error: upErr } = await supabase
      .from("leads")
      .update({
        etapa: "descredenciado",
        motivo_descredenciamento: data.motivo,
        descredenciado_em: nowIso,
        descredenciado_por: userId,
      } as never)
      .eq("id", data.lead_id);
    if (upErr) throw new Error(upErr.message);

    // 4) Registrar no histórico do lead
    await supabase.from("lead_historico").insert({
      lead_id: data.lead_id,
      user_id: userId,
      acao: "descredenciado",
      detalhe: { motivo: data.motivo } as never,
    });

    // 5) Bloquear acesso + reatribuir leads de vendas (operações privilegiadas)
    let userIdRemovido: string | null = null;
    let leadsVendasPendentes = 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (lead.email) {
      // Lookup do user pelo email via auth admin
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = authUsers?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === (lead.email ?? "").toLowerCase()
      );
      if (match) {
        userIdRemovido = match.id;
        // Desativar profile
        await supabaseAdmin
          .from("profiles")
          .update({ ativo: false } as never)
          .eq("id", match.id);
        // Remover TODOS os roles (dispara audit_user_roles_trigger automaticamente)
        await supabaseAdmin.from("user_roles").delete().eq("user_id", match.id);

        // 6) Marcar leads de vendas ativos para revisão
        const { count } = await supabaseAdmin
          .from("vendas_leads")
          .select("id", { count: "exact", head: true })
          .eq("corretor_id", match.id)
          .not("etapa", "in", "(fechado,perdido)");
        leadsVendasPendentes = count ?? 0;

        // 7) Notificar admins + executivo da região via OneSignal
        if (leadsVendasPendentes > 0) {
          // Coletar destinatários: todos os admins + executivo do lead
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          const externalIds = Array.from(
            new Set([
              ...(admins ?? []).map((a) => a.user_id as string),
              ...(lead.responsavel_id ? [lead.responsavel_id] : []),
            ])
          );
          if (externalIds.length > 0) {
            try {
              const { sendOneSignalPush } = await import("@/lib/onesignal.server");
              await sendOneSignalPush({
                externalIds,
                title: "Reatribuição necessária",
                message: `Leads de ${lead.nome} precisam ser reatribuídos após descredenciamento (${leadsVendasPendentes} ativo${leadsVendasPendentes > 1 ? "s" : ""}).`,
                url: "/vendas/leads",
                data: { tipo: "descredenciamento_reatribuir", corretor_id: match.id },
              });
            } catch (err) {
              console.warn("[descredenciar] push falhou", err);
            }
          }
        }
      }
    }

    // 8) Log de auditoria com motivo (além do role_revoke do trigger)
    await supabase.rpc("log_audit", {
      _acao: "corretor_descredenciado",
      _tabela: "leads",
      _registro_id: data.lead_id,
      _antes: { etapa: "fechado" } as never,
      _depois: { etapa: "descredenciado", motivo: data.motivo } as never,
      _contexto: {
        lead_nome: lead.nome,
        lead_email: lead.email,
        user_id_removido: userIdRemovido,
        leads_vendas_pendentes: leadsVendasPendentes,
      } as never,
    });

    return {
      ok: true,
      user_id_removido: userIdRemovido,
      leads_vendas_pendentes: leadsVendasPendentes,
    };
  });
