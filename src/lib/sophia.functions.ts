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
        description: "PIPELINE DE VENDAS DE IMÓVEIS (corretores atendendo clientes que querem comprar/alugar). Conta leads de vendas por período (hoje/semana/mes/total) e/ou etapa (novo, contato, qualificado, visita, proposta, negociacao, fechado, perdido). Para captação de corretores use captacao_contar_leads.",
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
        description: "PIPELINE DE VENDAS DE IMÓVEIS. Busca leads de vendas (clientes querendo comprar/alugar imóvel) por nome ou telefone. Para captação de corretores use captacao_buscar_lead.",
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

      analisar_padroes_insights: tool({
        description: "Analisa padrões e gera insights inteligentes sobre conversão por região, origem (canal), dia da semana e tempo médio até fechamento. Usa os últimos 90 dias dentro do escopo permitido.",
        inputSchema: z.object({}),
        execute: async () => {
          const permitidos = corretoresPermitidos();
          const since = new Date(); since.setDate(since.getDate() - 90);
          let q = supabaseAdmin
            .from("vendas_leads")
            .select("etapa, regiao, executivo_canal, created_at, updated_at, corretor_id")
            .gte("created_at", since.toISOString());
          if (permitidos !== "todos") q = q.in("corretor_id", permitidos);
          const { data } = await q;
          const leads = (data ?? []) as Array<{ etapa: string; regiao: string | null; executivo_canal: string | null; created_at: string; updated_at: string; corretor_id: string | null }>;
          const total = leads.length;
          if (!total) return { aviso: "Sem dados suficientes nos últimos 90 dias." };

          const agg = (key: "regiao" | "executivo_canal") => {
            const m = new Map<string, { total: number; fechados: number }>();
            leads.forEach((l) => {
              const k = (l[key] as string | null) ?? "(sem)";
              const cur = m.get(k) ?? { total: 0, fechados: 0 };
              cur.total += 1;
              if (l.etapa === "fechado") cur.fechados += 1;
              m.set(k, cur);
            });
            return Array.from(m.entries())
              .map(([k, v]) => ({ chave: k, total: v.total, fechados: v.fechados, taxa_conversao_pct: Math.round((v.fechados / v.total) * 1000) / 10 }))
              .sort((a, b) => b.taxa_conversao_pct - a.taxa_conversao_pct);
          };

          const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
          const porDia: Array<{ dia: string; leads: number; fechados: number }> = diasSemana.map((dia) => ({ dia, leads: 0, fechados: 0 }));
          leads.forEach((l) => {
            const d = new Date(l.created_at).getDay();
            const bucket = porDia[d];
            if (!bucket) return;
            bucket.leads += 1;
            if (l.etapa === "fechado") bucket.fechados += 1;
          });

          const fechados = leads.filter((l) => l.etapa === "fechado");
          const tempos = fechados.map((l) => (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000);
          const tempoMedioDias = tempos.length ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10 : null;

          return {
            periodo: "últimos 90 dias",
            total_leads: total,
            total_fechados: fechados.length,
            taxa_conversao_geral_pct: Math.round((fechados.length / total) * 1000) / 10,
            por_regiao: agg("regiao").slice(0, 8),
            por_canal: agg("executivo_canal").slice(0, 8),
            por_dia_semana: porDia,
            tempo_medio_fechamento_dias: tempoMedioDias,
          };
        },
      }),

      sugestoes_proativas: tool({
        description: "Detecta situações que merecem atenção AGORA dentro do escopo: leads parados há muito tempo, corretores sem atividade, reuniões próximas. Use quando o usuário pedir sugestões ou quando for útil propor próximos passos.",
        inputSchema: z.object({}),
        execute: async () => {
          const permitidos = corretoresPermitidos();
          const agora = new Date();
          const h48 = new Date(agora.getTime() - 48 * 3600 * 1000).toISOString();
          const h72 = new Date(agora.getTime() - 72 * 3600 * 1000).toISOString();
          const amanha = new Date(agora.getTime() + 36 * 3600 * 1000).toISOString();

          let lp = supabaseAdmin
            .from("vendas_leads")
            .select("id, nome, etapa, corretor_id, updated_at")
            .in("etapa", ["novo", "contato", "qualificado"] as never[])
            .lt("updated_at", h48)
            .limit(20);
          if (permitidos !== "todos") lp = lp.in("corretor_id", permitidos);
          const { data: leadsParados } = await lp;

          let alerts: Array<{ tipo: string; mensagem: string; corretor_id?: string | null }> = [];
          (leadsParados ?? []).forEach((l) => {
            alerts.push({ tipo: "lead_parado", mensagem: `Lead "${l.nome}" parado em ${l.etapa} há mais de 48h`, corretor_id: l.corretor_id });
          });

          let corretoresSemAtividade: Array<{ id: string; nome: string }> = [];
          if (scope.tipo !== "corretor") {
            const ids = scope.tipo === "executivo" ? scope.corretorIds : null;
            let prof = supabaseAdmin.from("profiles").select("id, nome").eq("ativo", true);
            if (ids) prof = prof.in("id", ids);
            const { data: profs } = await prof;
            const profIds = (profs ?? []).map((p) => p.id);
            if (profIds.length) {
              const { data: ativ } = await supabaseAdmin
                .from("lead_historico")
                .select("user_id")
                .in("user_id", profIds)
                .gte("created_at", h72);
              const ativos = new Set((ativ ?? []).map((a) => a.user_id));
              corretoresSemAtividade = (profs ?? []).filter((p) => !ativos.has(p.id)).slice(0, 10);
              corretoresSemAtividade.forEach((c) => {
                alerts.push({ tipo: "corretor_inativo", mensagem: `${c.nome} sem atividade nas últimas 72h` });
              });
            }
          }

          const rq = supabaseAdmin.from("reunioes").select("id, titulo, data_inicio").gte("data_inicio", agora.toISOString()).lt("data_inicio", amanha).order("data_inicio").limit(10);
          const { data: reunioes } = await rq;
          (reunioes ?? []).forEach((r) => {
            alerts.push({ tipo: "reuniao_proxima", mensagem: `Reunião "${r.titulo}" em ${new Date(r.data_inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` });
          });

          return {
            total_alertas: alerts.length,
            alertas: alerts.slice(0, 30),
            resumo: {
              leads_parados: leadsParados?.length ?? 0,
              corretores_inativos: corretoresSemAtividade.length,
              reunioes_proximas_36h: reunioes?.length ?? 0,
            },
          };
        },
      }),

      // ============ PIPELINE DE CAPTAÇÃO DE CORRETORES (tabela `leads`) ============
      captacao_contar_leads: tool({
        description: "PIPELINE DE CAPTAÇÃO DE CORRETORES (executivos recrutando novos corretores para o time). Conta leads de captação por período e/ou etapa (novos_leads, em_atendimento, reuniao_agendada, fechado, descartado). Admin vê todos; executivo vê apenas o próprio funil (responsavel_id); corretor não tem acesso.",
        inputSchema: z.object({
          periodo: z.enum(["hoje", "semana", "mes", "total"]).default("hoje"),
          etapa: z.string().optional(),
        }),
        execute: async ({ periodo, etapa }) => {
          if (scope.tipo === "corretor") return { erro: NEGADO };
          let q = supabaseAdmin.from("leads").select("id, etapa, created_at, responsavel_id", { count: "exact" });
          if (scope.tipo === "executivo") q = q.eq("responsavel_id", scope.responsavelId);
          const now = new Date();
          if (periodo === "hoje") {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            q = q.gte("created_at", d.toISOString());
          } else if (periodo === "semana") {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            q = q.gte("created_at", d.toISOString());
          } else if (periodo === "mes") {
            const d = new Date(now); d.setMonth(d.getMonth() - 1);
            q = q.gte("created_at", d.toISOString());
          }
          if (etapa) q = q.eq("etapa", etapa as never);
          const { data, count } = await q;
          return { pipeline: "captacao_corretores", total: count ?? data?.length ?? 0, periodo, etapa: etapa ?? null };
        },
      }),

      captacao_buscar_lead: tool({
        description: "PIPELINE DE CAPTAÇÃO DE CORRETORES. Busca leads de captação (pessoas querendo trabalhar como corretor) por nome ou telefone.",
        inputSchema: z.object({ termo: z.string().min(2) }),
        execute: async ({ termo }) => {
          if (scope.tipo === "corretor") return { erro: NEGADO };
          let q = supabaseAdmin
            .from("leads")
            .select("id, nome, telefone, etapa, regiao, canal, responsavel_id")
            .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
            .limit(10);
          if (scope.tipo === "executivo") q = q.eq("responsavel_id", scope.responsavelId);
          const { data } = await q;
          return { pipeline: "captacao_corretores", leads: data ?? [] };
        },
      }),

      captacao_relatorio: tool({
        description: "PIPELINE DE CAPTAÇÃO DE CORRETORES. Resumo dos últimos 7 dias por etapa (novos_leads, em_atendimento, reuniao_agendada, fechado, descartado).",
        inputSchema: z.object({}),
        execute: async () => {
          if (scope.tipo === "corretor") return { erro: NEGADO };
          const since = new Date(); since.setDate(since.getDate() - 7);
          let q = supabaseAdmin.from("leads").select("etapa, responsavel_id").gte("created_at", since.toISOString());
          if (scope.tipo === "executivo") q = q.eq("responsavel_id", scope.responsavelId);
          const { data } = await q;
          const por_etapa: Record<string, number> = {};
          (data ?? []).forEach((l) => { por_etapa[l.etapa] = (por_etapa[l.etapa] ?? 0) + 1; });
          return { pipeline: "captacao_corretores", total_7d: data?.length ?? 0, por_etapa };
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
        content: `Você é a Laura, assistente IA interna do Sistema Nexus da imobiliária Iuri Rodrigues. Tom profissional, prestativa, respostas claras e diretas em português brasileiro. Use markdown leve quando ajudar a leitura.

⛔ REGRAS ABSOLUTAS DE PRECISÃO E TEMPO REAL (NUNCA QUEBRE):
1. **TUDO em tempo real**: para QUALQUER pergunta sobre números, status, leads, corretores, reuniões, agenda, pipeline ou métricas, você SEMPRE chama uma ferramenta NA HORA da resposta. Os dados mudam a cada minuto; nunca trate respostas anteriores como fonte de verdade.
2. **Zero invenção**: se a ferramenta não retornar o dado pedido, responda EXATAMENTE: "Não encontrei essa informação no sistema." Não estime, não arredonde, não chute.
3. **Zero vazamento**: se o dado pertencer a alguém fora do seu escopo, responda EXATAMENTE: "Não tenho acesso a essa informação." (sem dizer que existe).
4. **Cite os números reais** que vieram da ferramenta — nunca "muitos leads" quando há um número exato.
5. **Refaça a busca a cada turno**: mesmo se a pergunta for parecida com a anterior, chame a ferramenta de novo — o banco pode ter mudado entre as duas mensagens.

CONTROLE DE ACESSO DO USUÁRIO ATUAL:
${escopoTexto}${regrasComuns}

EQUIPE DE EXECUTIVOS E REGIÕES (conhecimento fixo, pode ser citado para qualquer perfil):
- Denise → Nilópolis e Mesquita
- Fabíola → Recreio dos Bandeirantes
- Renata → Belford Roxo
- Robson → Barra da Tijuca

Para dados em tempo real (leads ativos, corretores na equipe, disponibilidade, pipeline, reuniões, métricas) use as ferramentas e cite números reais do banco. Antes de atribuir um lead, sempre confirme com o usuário.

VOCÊ É TAMBÉM UMA ESPECIALISTA EM:

🎯 ESTRATÉGIA DE VENDAS IMOBILIÁRIAS
Quando perguntada sobre como vender um imóvel, montar abordagem ou converter um lead, entregue um PLANO COMPLETO e personalizado:
1. **Análise do imóvel/perfil do cliente** — público-alvo provável, faixa de renda, perfil familiar.
2. **Canais de divulgação recomendados** — ZAP, Viva Real, OLX, Instagram, indicações, parcerias.
3. **Script de abordagem** — abertura, qualificação (SPIN), descoberta de dor, agendamento.
4. **Argumentos de venda** — diferenciais reais do imóvel/região, prova social, escassez ética.
5. **Técnicas de negociação** — ancoragem, troca de concessões, fechamento por alternativas.
6. **Próximos passos concretos** — o que fazer hoje, esta semana, neste mês.
Use formatação em seções com títulos claros. Exemplos práticos > teoria abstrata.

📣 MARKETING IMOBILIÁRIO
- Ajude a redigir **anúncios** persuasivos (título com gatilho + bullets de benefícios + CTA claro).
- Sugira **descrições** que destaquem lifestyle, não só metragem.
- Recomende **fotos** ideais (ordem, ângulos, horário de luz, ambientes prioritários).
- Indique **portais e horários** de publicação (Instagram entre 18h-21h, ZAP/Viva manhã).
- Quando houver dados, cite o que está mais procurado na região consultada via analisar_padroes_insights.

🧑‍🏫 COACHING PARA CORRETORES
Quando o corretor pedir orientação ("como abordar lead frio", "lead não responde", "perdi o cliente para concorrente"):
- Aja como **mentor experiente**, não como manual.
- Dê **scripts prontos** (mensagem de WhatsApp, áudio, ligação) que ele possa usar AGORA.
- Trabalhe a **mentalidade**: persistência cordial, foco no problema do cliente, follow-up programado.
- Encerre sempre com **1 ação concreta** para ele executar nas próximas 24h.

💡 RELATÓRIOS INTELIGENTES E SUGESTÕES PROATIVAS
- Quando o usuário pedir relatórios, panorama, ou desempenho, chame **analisar_padroes_insights** e traduza os números em INSIGHTS acionáveis (ex.: "Barra converte 40% acima da média — vale concentrar mídia paga lá").
- Quando o usuário pedir sugestões, "o que devo fazer", "alguma dica" — ou no início de uma conversa de gestão — chame **sugestoes_proativas** e proponha de 2 a 4 ações priorizadas, no formato:
  • **Situação** → **Ação sugerida** (com 1 frase do porquê).
- Nunca apenas despeje os números crus: sempre interprete.`,
      },
      ...data.messages.map((m) => {
        if (m.role === "user" && m.imageDataUrl) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content },
              { type: "image", image: m.imageDataUrl },
            ],
          } as ModelMessage;
        }
        return { role: m.role, content: m.content } as ModelMessage;
      }),
    ];

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });

    return { reply: text };
  });

// Snapshot ao vivo carregado quando o chat abre — dá contexto imediato sem precisar conversar.
export const sophiaContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolverAcesso(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const agora = new Date();
    const inicioDia = new Date(agora); inicioDia.setHours(0, 0, 0, 0);
    const h48 = new Date(agora.getTime() - 48 * 3600 * 1000).toISOString();
    const amanha = new Date(agora.getTime() + 36 * 3600 * 1000).toISOString();

    const permitidos: string[] | "todos" =
      scope.tipo === "admin" ? "todos" :
      scope.tipo === "executivo" ? [scope.userId, ...scope.corretorIds] :
      [scope.userId];

    let lq = supabaseAdmin.from("vendas_leads").select("id, etapa, updated_at, created_at, corretor_id");
    if (permitidos !== "todos") lq = lq.in("corretor_id", permitidos);
    const { data: leadsAll } = await lq;
    const leads = leadsAll ?? [];
    const ativos = leads.filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido").length;
    const hoje = leads.filter((l) => new Date(l.created_at) >= inicioDia).length;
    const parados48h = leads.filter((l) => ["novo", "contato", "qualificado"].includes(l.etapa) && l.updated_at < h48).length;

    const { data: reun } = await supabaseAdmin
      .from("reunioes" as never)
      .select("id, titulo, data_inicio")
      .gte("data_inicio", agora.toISOString())
      .lt("data_inicio", amanha)
      .order("data_inicio")
      .limit(5);
    const reunioes = (reun ?? []) as unknown as { id: string; titulo: string; data_inicio: string }[];

    return {
      gerado_em: agora.toISOString(),
      usuario: { nome: scope.nome, tipo: scope.tipo },
      snapshot: {
        leads_ativos: ativos,
        leads_novos_hoje: hoje,
        leads_parados_48h: parados48h,
        proximas_reunioes_36h: reunioes.length,
      },
      proxima_reuniao: reunioes[0]
        ? {
            titulo: reunioes[0].titulo,
            quando: new Date(reunioes[0].data_inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
          }
        : null,
    };
  });
