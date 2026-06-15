import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
  imageDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

type Scope =
  | { tipo: "admin"; userId: string; nome: string }
  | { tipo: "executivo"; userId: string; nome: string; responsavelId: string; responsavelNome: string; regiao: string | null; corretorIds: string[] }
  | { tipo: "corretor"; userId: string; nome: string };

async function resolverAcesso(
  supabaseUser: SupabaseClient,
  userId: string,
): Promise<Scope> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseUser.rpc("has_role", { _user_id: userId, _role: "admin" });

  const { data: cfg } = await supabaseAdmin
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["sophia_executivos_acesso", "sophia_corretores_acesso"]);
  const cfgMap = new Map((cfg ?? []).map((r) => [r.chave, r.valor]));

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, responsavel_id")
    .eq("id", userId)
    .maybeSingle();
  const nome = profile?.nome ?? "";

  if (isAdmin) return { tipo: "admin", userId, nome };

  // Detecta executivo: profile.nome corresponde a um responsaveis ativo (match por primeiro nome, case-insensitive)
  const primeiroNome = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (primeiroNome) {
    const { data: resp } = await supabaseAdmin
      .from("responsaveis")
      .select("id, nome, regiao, ativo")
      .eq("ativo", true);
    const meuResp = (resp ?? []).find((r) => (r.nome ?? "").trim().toLowerCase().split(/\s+/)[0] === primeiroNome);
    if (meuResp) {
      if (!cfgMap.get("sophia_executivos_acesso")) {
        throw new Error("Laura ainda não está liberada para executivos. Solicite acesso ao Admin.");
      }
      const { data: equipe } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("responsavel_id", meuResp.id);
      const corretorIds = (equipe ?? []).map((p) => p.id).filter((id) => id !== userId);
      return {
        tipo: "executivo",
        userId,
        nome,
        responsavelId: meuResp.id,
        responsavelNome: meuResp.nome,
        regiao: meuResp.regiao,
        corretorIds,
      };
    }
  }

  // Corretor
  if (!cfgMap.get("sophia_corretores_acesso")) {
    throw new Error("Laura ainda não está liberada para corretores. Solicite acesso ao Admin.");
  }
  return { tipo: "corretor", userId, nome };
}

export const sophiaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await resolverAcesso(context.supabase as unknown as SupabaseClient, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const NEGADO = "Não tenho autorização para compartilhar essas informações.";

    function corretoresPermitidos(): string[] | "todos" {
      if (scope.tipo === "admin") return "todos";
      if (scope.tipo === "executivo") return [scope.userId, ...scope.corretorIds];
      return [scope.userId];
    }

    const tools = {
      listar_corretores_disponiveis: tool({
        description: "Lista corretores de vendas disponíveis, opcionalmente filtrando por região e horário (HH:MM).",
        inputSchema: z.object({
          regiao: z.string().optional(),
          hora: z.string().optional(),
        }),
        execute: async ({ regiao, hora }) => {
          const permitidos = corretoresPermitidos();
          let q = supabaseAdmin.from("profiles").select("id, nome, ativo, responsavel_id").eq("ativo", true);
          if (permitidos !== "todos") q = q.in("id", permitidos);
          const { data: profiles } = await q;
          const ids = (profiles ?? []).map((p) => p.id);
          if (!ids.length) return { corretores: [], aviso: scope.tipo === "corretor" ? "Apenas seus próprios dados." : null };

          const { data: roles } = await supabaseAdmin
            .from("user_roles").select("user_id, role").in("user_id", ids);
          const vendasIds = new Set((roles ?? []).filter((r) => r.role === "corretor_vendas" || r.role === "corretor").map((r) => r.user_id));
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
          const _ = regiao;
          return { corretores: result.filter((c) => c.disponivel || !hora) };
        },
      }),

      contar_leads: tool({
        description: "Conta leads do escopo permitido por período (hoje/semana/mes/total) e/ou etapa.",
        inputSchema: z.object({
          periodo: z.enum(["hoje", "semana", "mes", "total"]).default("hoje"),
          etapa: z.string().optional(),
        }),
        execute: async ({ periodo, etapa }) => {
          const permitidos = corretoresPermitidos();
          let query = supabaseAdmin.from("vendas_leads").select("id, etapa, created_at, corretor_id", { count: "exact" });
          if (permitidos !== "todos") query = query.in("corretor_id", permitidos);
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
          return { total: count ?? data?.length ?? 0, periodo, etapa: etapa ?? null, escopo: scope.tipo };
        },
      }),

      buscar_lead: tool({
        description: "Busca leads do escopo permitido por nome ou telefone. Retorna até 10 resultados.",
        inputSchema: z.object({ termo: z.string().min(2) }),
        execute: async ({ termo }) => {
          const permitidos = corretoresPermitidos();
          let q = supabaseAdmin
            .from("vendas_leads")
            .select("id, nome, telefone, etapa, regiao, corretor_id")
            .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
            .limit(10);
          if (permitidos !== "todos") q = q.in("corretor_id", permitidos);
          const { data } = await q;
          return { leads: data ?? [] };
        },
      }),

      atribuir_lead: tool({
        description: "Atribui um lead de vendas a um corretor. Apenas admin e executivo podem usar; executivo só atribui para a própria equipe.",
        inputSchema: z.object({
          lead_id: z.string().uuid(),
          corretor_id: z.string().uuid(),
        }),
        execute: async ({ lead_id, corretor_id }) => {
          if (scope.tipo === "corretor") return { ok: false, erro: NEGADO };
          if (scope.tipo === "executivo" && !scope.corretorIds.includes(corretor_id) && corretor_id !== scope.userId) {
            return { ok: false, erro: NEGADO };
          }
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
        description: "Resumo dos últimos 7 dias: leads por etapa, dentro do escopo permitido.",
        inputSchema: z.object({}),
        execute: async () => {
          const permitidos = corretoresPermitidos();
          const since = new Date(); since.setDate(since.getDate() - 7);
          let q = supabaseAdmin.from("vendas_leads").select("etapa, corretor_id").gte("created_at", since.toISOString());
          if (permitidos !== "todos") q = q.in("corretor_id", permitidos);
          const { data } = await q;
          const por_etapa: Record<string, number> = {};
          (data ?? []).forEach((l) => { por_etapa[l.etapa] = (por_etapa[l.etapa] ?? 0) + 1; });
          return { total_7d: data?.length ?? 0, por_etapa, escopo: scope.tipo };
        },
      }),

      info_executivos: tool({
        description: "Informações sobre executivos e suas regiões. Apenas admin vê todos; executivo vê apenas a si mesmo; corretor não tem acesso.",
        inputSchema: z.object({
          regiao: z.string().optional(),
          nome: z.string().optional(),
        }),
        execute: async ({ regiao, nome }) => {
          if (scope.tipo === "corretor") return { erro: NEGADO };

          const { data: execs } = await supabaseAdmin
            .from("responsaveis").select("id, nome, regiao, ativo").eq("ativo", true);
          let lista = execs ?? [];
          if (scope.tipo === "executivo") {
            lista = lista.filter((e) => e.id === scope.responsavelId);
          }
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

    const escopoTexto =
      scope.tipo === "admin"
        ? `Você está conversando com um ADMINISTRADOR (${scope.nome}). Acesso total: todos os executivos, corretores, leads e métricas.`
        : scope.tipo === "executivo"
        ? `Você está conversando com a EXECUTIVA/EXECUTIVO ${scope.responsavelNome} (região: ${scope.regiao ?? "n/a"}). Acesso APENAS à própria equipe (${scope.corretorIds.length} corretor(es)) e aos próprios leads. NUNCA revele dados de outros executivos ou de corretores de outra equipe.`
        : `Você está conversando com um CORRETOR (${scope.nome}). Acesso APENAS aos próprios leads, agenda e métricas. NUNCA revele dados de outros corretores ou executivos.`;

    const regrasComuns =
      scope.tipo === "admin"
        ? ""
        : `\n\nTEMAS BLOQUEADOS (responda exatamente: "Esse assunto não está dentro das minhas atribuições"):
- Processos internos da empresa
- Vida pessoal de gestores ou colegas
- Salários e comissões de outras pessoas
- Informações confidenciais
- Dados de outros executivos ou corretores fora do seu escopo

Se perguntarem sobre outro executivo: "Não tenho autorização para compartilhar informações de outros executivos."
Se perguntarem sobre corretor fora do seu escopo: "Não tenho autorização para compartilhar informações de outros corretores."`;

    const messages: ModelMessage[] = [
      {
        role: "system",
        content: `Você é a Laura, assistente IA interna do Sistema Nexus da imobiliária Iuri Rodrigues. Tom profissional, prestativa, respostas claras e diretas em português brasileiro. NUNCA invente informações — se não souber, responda "Não tenho essa informação no momento". Use markdown leve quando ajudar a leitura.

CONTROLE DE ACESSO DO USUÁRIO ATUAL:
${escopoTexto}${regrasComuns}

EQUIPE DE EXECUTIVOS E REGIÕES (conhecimento fixo, pode ser citado para qualquer perfil):
- Denise → Nilópolis e Mesquita
- Fabíola → Recreio dos Bandeirantes
- Renata → Belford Roxo
- Robson → Barra da Tijuca

Para dados em tempo real (leads ativos, corretores na equipe, disponibilidade, pipeline, reuniões, métricas) use as ferramentas e cite números reais do banco. Antes de atribuir um lead, sempre confirme com o usuário.`,
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
