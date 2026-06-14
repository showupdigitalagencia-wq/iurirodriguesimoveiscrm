import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePushExternalId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean(),
        externalId: z.string().trim().min(1).max(200).nullable().optional(),
        responsavelId: z.string().uuid().nullable().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.enabled && !data.externalId) {
          ctx.addIssue({ code: "custom", message: "externalId obrigatório" });
        }
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, responsavel_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError || !profile) throw new Error(profileError?.message ?? "Perfil não encontrado");

    if (data.responsavelId && profile.responsavel_id !== data.responsavelId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Você só pode ativar notificações do seu próprio corretor");
    }

    const value = data.enabled ? data.externalId! : null;

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ onesignal_external_id: value })
      .eq("id", context.userId);
    if (profileUpdateError) throw new Error(profileUpdateError.message);

    if (data.responsavelId) {
      const { error: responsavelUpdateError } = await supabaseAdmin
        .from("responsaveis")
        .update({ onesignal_external_id: value })
        .eq("id", data.responsavelId);
      if (responsavelUpdateError) throw new Error(responsavelUpdateError.message);
    }

    return { ok: true, externalId: value };
  });