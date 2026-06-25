import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const listResponsaveisWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("responsaveis")
      .select("id, canal, nome, whatsapp")
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateResponsavelWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      nome: z.string().trim().min(1).max(200),
      whatsapp: z.string().trim().min(8).max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("responsaveis")
      .update({ nome: data.nome, whatsapp: data.whatsapp.replace(/\D/g, "") })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
