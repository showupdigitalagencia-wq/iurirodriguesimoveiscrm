import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

async function assertAcesso(supabase: SupabaseClient, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return "admin";
  const { data: cfg } = await supabase.from("configuracoes").select("chave, valor").in("chave", [
    "sophia_executivos_acesso",
    "sophia_corretores_acesso",
  ]);
  const map = new Map((cfg ?? []).map((r) => [r.chave, r.valor]));
  // Executivos == admins of vendas? For now allow if toggle on and user is corretor_vendas
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isCorretor = (roles ?? []).some((r) => r.role === "corretor_vendas" || r.role === "corretor");
  if (isCorretor && map.get("sophia_corretores_acesso") === true) return "corretor";
  throw new Error("Sophia ainda não está disponível para você.");
}

export const sophiaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAcesso(context.supabase as unknown as SupabaseClient, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const tools = {
      listar_corretores_disponiveis: tool({
        description: "Lista corretores de vendas disponíveis, opcionalmente filtrando por região e horário (HH:MM, formato 24h).",
        inputSchema: z.object({
          regiao: z.string().optional().describe("Região solicitada, ex: 'Barra', 'Recreio'"),
          hora: z.string().optional().describe("Horário desejado em formato HH:MM"),
        }),
        execute: async ({ regiao, hora }) => {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, nome, ativo, responsavel_id")
            .eq("ativo", true);
          const ids = (profiles ?? []).map((p) => p.id);
          if (!ids.length) return { corretores: [] };

          const { data: roles } = await supabaseAdmin
            .from("user_roles").select("user_id, role").in("user_id", ids);
          const vendasIds = new Set((roles ?? []).filter((r) => r.role === "corretor_vendas").map((r) => r.user_id));
          const corretores = (profiles ?? []).filter((p) => vendasIds.has(p.id));
          if (!corretores.length) return { corretores: [] };

          const { data: disp } = await supabaseAdmin
            .from("corretor_disponibilidade")
            .select("corretor_id, tipo, dia_semana, data, hora_inicio, hora_fim")
            .in("corretor_id", corretores.map((c) => c.id));

          const now = new Date();
          const targetDay = now.getDay();
          const targetTime = hora ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          const todayISO = now.toISOString().slice(0, 10);

          const result = corretores.map((c) => {
            const meus = (disp ?? []).filter((d) => d.corretor_id === c.id);
            const bloqueado = meus.some((d) => d.tipo === "bloqueio" && d.data === todayISO);
            const livre = !bloqueado && meus.some((d) => {
              if (d.tipo !== "recorrente") return false;
              if (d.dia_semana !== targetDay) return false;
              return (d.hora_inicio ?? "00:00") <= targetTime && targetTime <= (d.hora_fim ?? "23:59");
            });
            return { id: c.id, nome: c.nome, disponivel: livre };
          });
          // regiao filtering is descriptive only — corretor disponibilidade não tem campo regiao
          const _ = regiao;
          return { corretores: result.filter((c) => c.disponivel || !hora) };
        },
      }),

      contar_leads: tool({
        description: "Conta leads por período (hoje, semana, mes) e/ou etapa.",
        inputSchema: z.object({
          periodo: z.enum(["hoje", "semana", "mes", "total"]).default("hoje"),
          etapa: z.string().optional(),
        }),
        execute: async ({ periodo, etapa }) => {
          let query = supabaseAdmin.from("leads").select("id, etapa, created_at", { count: "exact", head: false });
          const now = new Date();
          if (periodo === "hoje") {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            query = query.gte("created_at", d.toISOString());
          } else if (periodo === "semana") {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            query = query.gte("created_at", d.toISOString());
          } else if (periodo === "mes") {
            const d = new Date(now); d.setMonth(d.getMonth() - 1);
            query = query.gte("created_at", d.toISOString());
          }
          if (etapa) query = query.eq("etapa", etapa as never);
          const { data, count } = await query;
          return { total: count ?? data?.length ?? 0, periodo, etapa: etapa ?? null };
        },
      }),

      buscar_lead: tool({
        description: "Busca leads de vendas por nome ou telefone (busca parcial). Retorna até 10 resultados.",
        inputSchema: z.object({
          termo: z.string().min(2),
        }),
        execute: async ({ termo }) => {
          const { data } = await supabaseAdmin
            .from("vendas_leads")
            .select("id, nome, telefone, etapa, regiao, corretor_id")
            .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
            .limit(10);
          return { leads: data ?? [] };
        },
      }),

      atribuir_lead: tool({
        description: "Atribui um lead de vendas a um corretor específico.",
        inputSchema: z.object({
          lead_id: z.string().uuid(),
          corretor_id: z.string().uuid(),
        }),
        execute: async ({ lead_id, corretor_id }) => {
          const { error } = await supabaseAdmin
            .from("vendas_leads")
            .update({
              corretor_id,
              atribuicao_status: "pendente",
              atribuido_em: new Date().toISOString(),
              atribuido_por: context.userId,
            })
            .eq("id", lead_id);
          if (error) return { ok: false, erro: error.message };
          return { ok: true, mensagem: "Lead atribuído. Aguardando aceite do corretor." };
        },
      }),

      relatorio_rapido: tool({
        description: "Gera um resumo rápido: leads por etapa nos últimos 7 dias.",
        inputSchema: z.object({}),
        execute: async () => {
          const since = new Date(); since.setDate(since.getDate() - 7);
          const { data } = await supabaseAdmin
            .from("leads").select("etapa").gte("created_at", since.toISOString());
          const por_etapa: Record<string, number> = {};
          (data ?? []).forEach((l) => { por_etapa[l.etapa] = (por_etapa[l.etapa] ?? 0) + 1; });
          return { total_7d: data?.length ?? 0, por_etapa };
        },
      }),

      info_executivos: tool({
        description: "Retorna executivos cadastrados, suas regiões, total de corretores na equipe e leads ativos. Use para perguntas sobre quem atende qual região.",
        inputSchema: z.object({
          regiao: z.string().optional().describe("Filtra por região (busca parcial, case-insensitive)"),
          nome: z.string().optional().describe("Filtra por nome do executivo (busca parcial)"),
        }),
        execute: async ({ regiao, nome }) => {
          const { data: execs } = await supabaseAdmin
            .from("responsaveis")
            .select("id, nome, regiao, ativo")
            .eq("ativo", true);
          let lista = execs ?? [];
          if (regiao) lista = lista.filter((e) => (e.regiao ?? "").toLowerCase().includes(regiao.toLowerCase()));
          if (nome) lista = lista.filter((e) => (e.nome ?? "").toLowerCase().includes(nome.toLowerCase()));

          const ids = lista.map((e) => e.id);
          const profsRes = ids.length
            ? await supabaseAdmin.from("profiles").select("id, responsavel_id, ativo").in("responsavel_id", ids)
            : { data: [] as Array<{ id: string; responsavel_id: string | null; ativo: boolean }> };
          const profs = profsRes.data ?? [];
          const corretorIds = profs.map((p) => p.id);
          const leadsRes = corretorIds.length
            ? await supabaseAdmin.from("vendas_leads").select("id, corretor_id, etapa").in("corretor_id", corretorIds)
            : { data: [] as Array<{ id: string; corretor_id: string | null; etapa: string }> };
          const leadsAtivos = leadsRes.data ?? [];

          const resultado = lista.map((e) => {
            const corretores = profs.filter((p) => p.responsavel_id === e.id);
            const meusIds = new Set(corretores.map((c) => c.id));
            const leads = leadsAtivos.filter((l) => l.corretor_id && meusIds.has(l.corretor_id) && l.etapa !== "fechado" && l.etapa !== "perdido");
            return {
              nome: e.nome,
              regiao: e.regiao ?? "(sem região cadastrada)",
              total_corretores: corretores.length,
              corretores_ativos: corretores.filter((c) => c.ativo).length,
              leads_ativos: leads.length,
            };
          });
          return { executivos: resultado };
        },
      }),
    };

    const messages: ModelMessage[] = [
      {
        role: "system",
        content: `Você é a Sophia, assistente IA interna do Sistema Nexus da imobiliária Iuri Rodrigues. Seja direta, simpática e use português brasileiro. Use as ferramentas disponíveis para responder com dados reais. Quando for atribuir um lead, sempre confirme antes. Formate respostas em markdown quando ajudar a leitura.

EQUIPE DE EXECUTIVOS E REGIÕES DE ATUAÇÃO (conhecimento fixo):
- Denise → Nilópolis e Mesquita
- Fabíola → Recreio dos Bandeirantes
- Renata → Belford Roxo
- Robson → Barra da Tijuca

Responda imediatamente perguntas sobre qual executivo cuida de uma região (ou vice-versa) com base nessa lista. Para dados em tempo real (leads ativos, corretores na equipe, disponibilidade), use as ferramentas info_executivos ou listar_corretores_disponiveis e cite números atualizados do banco.`,
      },
      ...data.messages.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    ];

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });

    return { reply: text };
  });
