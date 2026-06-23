import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const salvarMetaCorretor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        corretor_id: z.string().uuid(),
        ano: z.number().int().min(2024).max(2100),
        mes: z.number().int().min(1).max(12),
        meta_vendas: z.number().int().min(0).max(9999),
        meta_locacoes: z.number().int().min(0).max(9999),
        meta_receita: z.number().min(0).max(1_000_000_000),
        meta_leads_atendidos: z.number().int().min(0).max(9999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica se já existia para distinguir criação x atualização
    const { data: existente } = await supabaseAdmin
      .from("metas_mensais")
      .select("id")
      .eq("corretor_id", data.corretor_id)
      .eq("ano", data.ano)
      .eq("mes", data.mes)
      .maybeSingle();

    const isUpdate = !!existente;

    const { error } = await supabaseAdmin.from("metas_mensais").upsert(
      {
        corretor_id: data.corretor_id,
        ano: data.ano,
        mes: data.mes,
        meta_vendas: data.meta_vendas,
        meta_locacoes: data.meta_locacoes,
        meta_receita: data.meta_receita,
        meta_leads_atendidos: data.meta_leads_atendidos,
      },
      { onConflict: "corretor_id,ano,mes" },
    );
    if (error) throw new Error(error.message);

    // Push (opcional — não bloqueia se falhar)
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("onesignal_external_id")
        .eq("id", data.corretor_id)
        .maybeSingle();
      const externalId = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
      if (externalId) {
        const total = data.meta_vendas + data.meta_locacoes;
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");
        await sendOneSignalPush({
          externalIds: [externalId],
          title: isUpdate ? "Sua meta deste mês foi atualizada" : "Você recebeu uma meta este mês",
          message: `${total} vendas/locações`,
          url: "/vendas/metas",
          data: { tipo: "meta_definida", ano: data.ano, mes: data.mes },
        });
      }
    } catch (e) {
      console.warn("[salvarMetaCorretor] push falhou", e);
    }

    return { ok: true, isUpdate };
  });
