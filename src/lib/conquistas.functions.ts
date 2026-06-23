import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConquistaItem = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  categoria: string;
  meta_valor: number;
  ordem: number;
  progresso: number;
  desbloqueada_em: string | null;
};

type CatRow = {
  id: string; nome: string; descricao: string; icone: string;
  categoria: string; meta_valor: number; ordem: number;
};
type UCRow = { conquista_id: string; progresso: number; desbloqueada_em: string | null; notificada: boolean };

// Recalcula e devolve a lista completa de conquistas do usuário com progresso.
export const listarMinhasConquistas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1) Recalcula (insere/atualiza progresso e marca desbloqueio)
    const { data: novas, error: errRpc } = await supabase
      .rpc("recalcular_conquistas_usuario", { _user_id: userId });
    if (errRpc) throw new Error(errRpc.message);

    // 2) Lista catálogo + progresso do usuário
    const [{ data: catRaw }, { data: ucRaw }] = await Promise.all([
      supabase.from("conquistas").select("*").eq("ativo", true).order("ordem", { ascending: true }),
      supabase.from("user_conquistas").select("conquista_id, progresso, desbloqueada_em, notificada").eq("user_id", userId),
    ]);

    const ucMap = new Map<string, UCRow>();
    for (const r of (ucRaw ?? []) as UCRow[]) ucMap.set(r.conquista_id, r);

    const items: ConquistaItem[] = ((catRaw ?? []) as CatRow[]).map((c) => {
      const uc = ucMap.get(c.id);
      return {
        ...c,
        progresso: uc?.progresso ?? 0,
        desbloqueada_em: uc?.desbloqueada_em ?? null,
      };
    });

    // 3) Push para novas conquistas ainda não notificadas
    const novasIds = ((novas ?? []) as Array<{ conquista_id: string; nome: string; icone: string }>);
    if (novasIds.length) {
      const pendentes = novasIds.filter((n) => {
        const uc = ucMap.get(n.conquista_id);
        return uc && uc.desbloqueada_em && !uc.notificada;
      });
      if (pendentes.length) {
        const { sendOneSignalPush } = await import("@/lib/onesignal.server");
        const { data: profRaw } = await supabase
          .from("profiles").select("nome, onesignal_external_id").eq("id", userId).maybeSingle();
        const prof = profRaw as { nome: string | null; onesignal_external_id: string | null } | null;
        const extId = prof?.onesignal_external_id;
        const userNome = prof?.nome ?? "Alguém";
        for (const p of pendentes) {
          if (extId) {
            await sendOneSignalPush({
              externalId: extId,
              title: `${p.icone} Nova conquista!`,
              message: `Você desbloqueou: ${p.nome}`,
              data: { tipo: "conquista", conquista_id: p.conquista_id },
            });
          }
          // Post automático no Feed (sem foto). RLS exige author_id = auth.uid().
          await supabase.from("feed_posts").insert({
            author_id: userId,
            caption: `🏆 ${userNome} conquistou: ${p.nome}!`,
            image_path: null,
            source: "conquista",
            source_ref: p.conquista_id,
            media_type: "image",
          } as never);
          await supabase.from("user_conquistas")
            .update({ notificada: true } as never)
            .eq("user_id", userId).eq("conquista_id", p.conquista_id);
        }
      }
    }

    return { items };
  });
