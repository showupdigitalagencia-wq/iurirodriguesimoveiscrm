import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOneSignalPush } from "@/lib/onesignal.server";

const Input = z.object({ imovelId: z.string().uuid() });

export const notifyImovelDisponivelNovamente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { imovelId: string }) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: imovel, error } = await supabase
      .from("imoveis")
      .select("id, codigo, rua, numero, bairro, cidade, captador_id, finalidade, status")
      .eq("id", data.imovelId)
      .maybeSingle();
    if (error || !imovel) return { ok: false, error: error?.message ?? "Imóvel não encontrado" };

    const endereco = [
      [imovel.rua, imovel.numero].filter(Boolean).join(", "),
      imovel.bairro,
      imovel.cidade,
    ].filter(Boolean).join(" — ");

    let targets: string[] = [];
    let usedFallback = false;
    if (imovel.captador_id) {
      targets = [imovel.captador_id];
    } else {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      targets = Array.from(new Set((admins ?? []).map((r) => r.user_id as string)));
      usedFallback = true;
    }
    if (!targets.length) return { ok: false, error: "Sem destinatários" };

    const title = usedFallback
      ? "🏠 Imóvel disponível novamente (sem captador definido)"
      : "🏠 O imóvel que você captou está disponível de novo!";
    const message = usedFallback
      ? `${imovel.codigo ?? ""} ${endereco} — defina um captador e/ou contate o proprietário.`
      : `${endereco} — entre em contato com o proprietário para alinhar uma nova locação.`;

    const res = await sendOneSignalPush({
      externalIds: targets,
      title,
      message,
      url: "/admin/imoveis",
      data: { imovel_id: imovel.id, tipo: "imovel_disponivel_novamente" },
    });
    return { ok: res.ok, error: res.error };
  });
