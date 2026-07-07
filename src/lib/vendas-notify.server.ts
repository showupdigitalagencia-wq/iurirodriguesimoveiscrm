// Server-only: notifica stakeholders (corretor + executivo gestor + admins)
// de um lead de vendas. Não importar em código de cliente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOneSignalPush } from "@/lib/onesignal.server";

type NotifyOpts = {
  leadId: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
  includeCorretor?: boolean;   // default true
  includeExecutivo?: boolean;  // default true
  includeAdmins?: boolean;     // default false
  excludeUserId?: string | null; // não enviar para o próprio ator
};

/**
 * Envia push ao corretor e ao executivo responsável pela equipe do corretor
 * (profiles.responsavel_id -> responsaveis.user_id). Best-effort: nunca lança.
 */
export async function notifyVendasLeadStakeholders(opts: NotifyOpts): Promise<void> {
  const {
    leadId,
    title,
    message,
    url,
    data,
    includeCorretor = true,
    includeExecutivo = true,
    includeAdmins = false,
    excludeUserId = null,
  } = opts;

  try {
    const { data: leadRow } = await supabaseAdmin
      .from("vendas_leads")
      .select("corretor_id")
      .eq("id", leadId)
      .maybeSingle();
    const corretorId = (leadRow as { corretor_id: string | null } | null)?.corretor_id ?? null;

    const userIds = new Set<string>();

    if (includeCorretor && corretorId) userIds.add(corretorId);

    let execUserId: string | null = null;
    if (includeExecutivo && corretorId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("responsavel_id").eq("id", corretorId).maybeSingle();
      const respId = (prof as { responsavel_id: string | null } | null)?.responsavel_id ?? null;
      if (respId) {
        const { data: resp } = await supabaseAdmin
          .from("responsaveis").select("user_id").eq("id", respId).maybeSingle();
        execUserId = (resp as { user_id: string | null } | null)?.user_id ?? null;
        if (execUserId) userIds.add(execUserId);
      }
    }

    if (includeAdmins) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", "admin");
      for (const r of (roles ?? []) as { user_id: string }[]) userIds.add(r.user_id);
    }

    if (excludeUserId) userIds.delete(excludeUserId);
    if (!userIds.size) return;

    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, onesignal_external_id").in("id", Array.from(userIds));
    const externalIds = ((profs ?? []) as { onesignal_external_id: string | null }[])
      .map((p) => p.onesignal_external_id)
      .filter((x): x is string => !!x);

    if (!externalIds.length) return;

    const res = await sendOneSignalPush({ externalIds, title, message, url, data });
    console.info("[vendas-notify] push", { leadId, count: externalIds.length, ok: res.ok });
  } catch (e) {
    console.warn("[vendas-notify] falhou", e);
  }
}
