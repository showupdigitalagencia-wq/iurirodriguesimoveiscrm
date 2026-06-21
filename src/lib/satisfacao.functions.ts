import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MENSAGEM_TEMPLATE = (nomeLead: string) =>
  `Olá ${nomeLead}! 👋\n\n` +
  `Aqui é da *Iuri Rodrigues Imóveis*. Parabéns pela conquista! 🎉\n\n` +
  `Para nos ajudar a melhorar, dá pra responder essa mensagem com uma nota de *1 a 5* para o atendimento do seu corretor?\n\n` +
  `*1* = Muito ruim\n*5* = Excelente\n\n` +
  `Se quiser, complemente com um comentário. Sua avaliação é super importante para nós! 🙏`;

async function checarAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase
    .rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores podem enviar pesquisas de satisfação.");
}

/**
 * Envia (ou reenvia) pesquisas de satisfação pendentes via Z-API.
 * Admin-only. Marca como 'enviada' com expira_em = +48h, ou 'falha_envio' em caso de erro.
 */
export const enviarPesquisasSatisfacaoPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checarAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendZapiMessage } = await import("@/lib/notify.server");

    const { data: pendentes, error } = await supabaseAdmin
      .from("pesquisas_satisfacao")
      .select("id, lead_id, telefone, tentativas, vendas_leads!inner(nome)")
      .eq("status", "pendente")
      .lt("tentativas", 3)
      .limit(50);

    if (error) throw new Error(error.message);
    if (!pendentes || pendentes.length === 0) return { enviadas: 0, falhas: 0 };

    let enviadas = 0;
    let falhas = 0;
    for (const p of pendentes) {
      const nome = (p.vendas_leads as { nome: string } | null)?.nome ?? "Cliente";
      const msg = MENSAGEM_TEMPLATE(nome);
      const result = await sendZapiMessage(p.telefone, msg);
      if (result.ok) {
        enviadas++;
        const now = new Date();
        const expira = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        await supabaseAdmin.from("pesquisas_satisfacao").update({
          status: "enviada",
          enviada_em: now.toISOString(),
          expira_em: expira.toISOString(),
          tentativas: (p.tentativas ?? 0) + 1,
          erro_envio: null,
        }).eq("id", p.id);
      } else {
        falhas++;
        const novoStatus = (p.tentativas ?? 0) + 1 >= 3 ? "falha_envio" : "pendente";
        await supabaseAdmin.from("pesquisas_satisfacao").update({
          status: novoStatus,
          tentativas: (p.tentativas ?? 0) + 1,
          erro_envio: result.error ?? "erro desconhecido",
        }).eq("id", p.id);
      }
    }

    return { enviadas, falhas };
  });

/**
 * Expira pesquisas enviadas há mais de 48h sem resposta.
 * Pode ser chamada por qualquer autenticado (Admin a usa no painel).
 */
export const expirarPesquisasSatisfacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checarAdmin(context);
    const { data, error } = await context.supabase.rpc("expirar_pesquisas_satisfacao");
    if (error) throw new Error(error.message);
    return { expiradas: data as number };
  });
