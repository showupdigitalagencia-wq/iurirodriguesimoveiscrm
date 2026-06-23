import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
  imageDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
  imageStoragePath: z.string().min(1).max(500).optional(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

type Scope =
  | { tipo: "admin"; userId: string; nome: string }
  | { tipo: "administrativo"; userId: string; nome: string }
  | { tipo: "executivo"; userId: string; nome: string; responsavelId: string; responsavelNome: string; regiao: string | null; corretorIds: string[] }
  | { tipo: "corretor"; userId: string; nome: string };

async function resolverAcesso(
  supabaseUser: SupabaseClient,
  userId: string,
): Promise<Scope> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseUser.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isAdministrativo } = await supabaseUser.rpc("has_role", { _user_id: userId, _role: "administrativo" });

  const { data: cfg } = await supabaseAdmin
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["sophia_executivos_acesso", "sophia_corretores_acesso", "sophia_chaves_acoes"]);
  const cfgMap = new Map((cfg ?? []).map((r) => [r.chave, r.valor]));

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, responsavel_id")
    .eq("id", userId)
    .maybeSingle();
  const nome = profile?.nome ?? "";

  if (isAdmin) return { tipo: "admin", userId, nome };
  if (isAdministrativo) return { tipo: "administrativo", userId, nome };

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

    // Flag global de ações de chave + foto anexada no último turno do usuário
    const { data: cfgChave } = await supabaseAdmin
      .from("configuracoes").select("valor").eq("chave", "sophia_chaves_acoes").maybeSingle();
    const chavesAcoesHabilitado = cfgChave?.valor === true;
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const lastFotoPath: string | null = lastUser?.imageStoragePath ?? null;

    const NEGADO = "Não tenho autorização para compartilhar essas informações.";
    const NEGADO_ADMIN = "Esse assunto não está dentro das minhas atribuições para o seu perfil";
    const podeAdmin = scope.tipo === "admin" || scope.tipo === "administrativo";

    function corretoresPermitidos(): string[] | "todos" {
      if (scope.tipo === "admin" || scope.tipo === "administrativo") return "todos";
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
        description: "PIPELINE DE VENDAS DE IMÓVEIS. Resumo dos últimos 7 dias por etapa. Para captação de corretores use captacao_relatorio.",
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

      // ============ MÓDULO ADMINISTRATIVO (apenas admin e administrativo) ============
      admin_contratos_vencendo: tool({
        description: "MÓDULO ADMINISTRATIVO. Lista contratos cuja data_fim vence dentro dos próximos N dias (padrão 60). Apenas admin/administrativo.",
        inputSchema: z.object({ dias: z.number().int().min(1).max(365).default(60) }),
        execute: async ({ dias }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          const hoje = new Date();
          const limite = new Date(hoje.getTime() + dias * 86400000);
          const hojeISO = hoje.toISOString().slice(0, 10);
          const limiteISO = limite.toISOString().slice(0, 10);
          const { data } = await supabaseAdmin
            .from("contratos")
            .select("id, locatario_nome, data_fim, valor_aluguel, status, imovel_id, imoveis(rua, numero, bairro)")
            .gte("data_fim", hojeISO)
            .lte("data_fim", limiteISO)
            .neq("status", "encerrado" as never)
            .neq("status", "rescindido" as never)
            .order("data_fim");
          return { periodo_dias: dias, total: data?.length ?? 0, contratos: data ?? [] };
        },
      }),

      admin_inadimplentes_hoje: tool({
        description: "MÓDULO ADMINISTRATIVO. Lista pagamentos em atraso/inadimplentes em tempo real (status atrasado ou inadimplente, ou vencidos não pagos). Apenas admin/administrativo.",
        inputSchema: z.object({}),
        execute: async () => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          const { data } = await supabaseAdmin
            .from("pagamentos")
            .select("id, contrato_id, mes_referencia, valor_previsto, valor_pago, status, contratos(locatario_nome, dia_vencimento, valor_aluguel)")
            .in("status", ["atrasado", "inadimplente"] as never[])
            .order("mes_referencia");
          const total_valor = (data ?? []).reduce((s, p) => s + Number(p.valor_previsto ?? 0), 0);
          return { total: data?.length ?? 0, valor_total: total_valor, pagamentos: data ?? [] };
        },
      }),

      admin_bons_pagadores: tool({
        description: "MÓDULO ADMINISTRATIVO. Locatários com contratos ativos e sem nenhum pagamento atrasado/inadimplente nos últimos N meses (padrão 6). Apenas admin/administrativo.",
        inputSchema: z.object({ meses: z.number().int().min(1).max(60).default(6) }),
        execute: async ({ meses }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          const desde = new Date(); desde.setMonth(desde.getMonth() - meses);
          const desdeISO = desde.toISOString().slice(0, 10);
          const { data: contratos } = await supabaseAdmin
            .from("contratos")
            .select("id, locatario_nome, valor_aluguel, data_inicio")
            .eq("status", "ativo" as never)
            .lte("data_inicio", desdeISO);
          const ids = (contratos ?? []).map((c) => c.id);
          if (!ids.length) return { meses, total: 0, locatarios: [] };
          const { data: ruins } = await supabaseAdmin
            .from("pagamentos")
            .select("contrato_id")
            .in("contrato_id", ids)
            .gte("mes_referencia", desdeISO)
            .in("status", ["atrasado", "inadimplente"] as never[]);
          const ruinSet = new Set((ruins ?? []).map((r) => r.contrato_id));
          const bons = (contratos ?? []).filter((c) => !ruinSet.has(c.id));
          return { meses, total: bons.length, locatarios: bons };
        },
      }),

      admin_imoveis_disponiveis: tool({
        description: "MÓDULO ADMINISTRATIVO. Lista imóveis com status 'disponivel'. Apenas admin/administrativo.",
        inputSchema: z.object({ bairro: z.string().optional() }),
        execute: async ({ bairro }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          let q = supabaseAdmin
            .from("imoveis")
            .select("id, tipo, rua, numero, bairro, cidade, valor_aluguel, quartos, area_m2")
            .eq("status", "disponivel" as never);
          if (bairro) q = q.ilike("bairro", `%${bairro}%`);
          const { data } = await q.order("created_at", { ascending: false });
          return { total: data?.length ?? 0, imoveis: data ?? [] };
        },
      }),

      admin_receita_periodo: tool({
        description: "MÓDULO ADMINISTRATIVO. Soma de pagamentos recebidos (status=pago) no período. periodo: 'mes_atual' (padrão), 'mes_anterior' ou intervalo N dias. Apenas admin/administrativo.",
        inputSchema: z.object({
          periodo: z.enum(["mes_atual", "mes_anterior", "ultimos_30d", "ultimos_60d", "ultimos_90d"]).default("mes_atual"),
        }),
        execute: async ({ periodo }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          const hoje = new Date();
          let inicio: Date, fim: Date;
          if (periodo === "mes_atual") {
            inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          } else if (periodo === "mes_anterior") {
            inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
          } else {
            const dias = periodo === "ultimos_30d" ? 30 : periodo === "ultimos_60d" ? 60 : 90;
            inicio = new Date(hoje.getTime() - dias * 86400000);
            fim = hoje;
          }
          const { data } = await supabaseAdmin
            .from("pagamentos")
            .select("valor_pago, data_pagamento, status")
            .eq("status", "pago" as never)
            .gte("data_pagamento", inicio.toISOString().slice(0, 10))
            .lte("data_pagamento", fim.toISOString().slice(0, 10));
          const total = (data ?? []).reduce((s, p) => s + Number(p.valor_pago ?? 0), 0);
          return { periodo, inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), total_recebido: total, qtd_pagamentos: data?.length ?? 0 };
        },
      }),

      admin_documentos_pendentes: tool({
        description: "MÓDULO ADMINISTRATIVO. Para um contrato, verifica quais documentos obrigatórios faltam (contrato, rg, cpf, comprovante_renda). Apenas admin/administrativo.",
        inputSchema: z.object({ contrato_id: z.string().uuid().optional(), locatario: z.string().optional() }),
        execute: async ({ contrato_id, locatario }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          let cid = contrato_id;
          let locName = "";
          if (!cid && locatario) {
            const { data } = await supabaseAdmin
              .from("contratos").select("id, locatario_nome").ilike("locatario_nome", `%${locatario}%`).limit(1);
            cid = data?.[0]?.id;
            locName = data?.[0]?.locatario_nome ?? "";
          }
          if (!cid) return { erro: "Informe contrato_id ou nome do locatário." };
          const { data: docs } = await supabaseAdmin
            .from("documentos").select("tipo, nome").eq("contrato_id", cid);
          const obrigatorios = ["contrato", "rg", "cpf", "comprovante_renda"];
          const presentes = new Set((docs ?? []).map((d) => d.tipo));
          const faltando = obrigatorios.filter((t) => !presentes.has(t));
          return { contrato_id: cid, locatario: locName, presentes: Array.from(presentes), faltando, total_documentos: docs?.length ?? 0 };
        },
      }),

      admin_imoveis_vendidos: tool({
        description: "MÓDULO ADMINISTRATIVO. Imóveis com status 'vendido' no período (padrão últimos 30 dias). Retorna quantidade e soma de valor_venda. Apenas admin/administrativo.",
        inputSchema: z.object({ dias: z.number().int().min(1).max(365).default(30) }),
        execute: async ({ dias }) => {
          if (!podeAdmin) return { erro: NEGADO_ADMIN };
          const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
          const { data } = await supabaseAdmin
            .from("imoveis")
            .select("id, rua, numero, bairro, data_venda, valor_venda")
            .eq("status", "vendido" as never)
            .gte("data_venda", desde)
            .order("data_venda", { ascending: false });
          const total_valor = (data ?? []).reduce((s, i) => s + Number(i.valor_venda ?? 0), 0);
          return { periodo_dias: dias, total: data?.length ?? 0, valor_total: total_valor, imoveis: data ?? [] };
        },
      }),

      // ============ PORTFÓLIO DE IMÓVEIS DISPONÍVEIS ============
      // Exceção controlada ao bloqueio administrativo: TODOS os perfis
      // (admin, administrativo, executivo, corretor) podem consultar imóveis
      // DISPONÍVEIS para oferecer aos leads. Retorna SOMENTE dados públicos —
      // nunca proprietário, locatário, contrato, pagamento ou comissão.
      portfolio_buscar_imoveis: tool({
        description: "Busca imóveis DISPONÍVEIS para locação ou venda no portfólio (visível para todos os perfis, inclusive corretores e executivos). Use para perguntas tipo 'temos apartamento na Barra por até R$ 2.500?', 'quais imóveis disponíveis em Recreio?'. Retorna APENAS dados públicos do imóvel — NUNCA dados do proprietário, contrato ou pagamento.",
        inputSchema: z.object({
          bairro: z.string().optional().describe("Bairro, região ou cidade (parcial, case-insensitive)"),
          tipo: z.string().optional().describe("apartamento, casa, comercial, cobertura, studio, terreno..."),
          finalidade: z.enum(["locacao", "venda"]).optional(),
          quartos_min: z.number().int().min(0).max(10).optional(),
          valor_max: z.number().min(0).optional().describe("Valor máximo (aluguel se finalidade=locacao, venda se finalidade=venda)"),
          valor_min: z.number().min(0).optional(),
          limite: z.number().int().min(1).max(30).default(15),
        }),
        execute: async ({ bairro, tipo, finalidade, quartos_min, valor_max, valor_min, limite }) => {
          let q = supabaseAdmin
            .from("imoveis_portfolio")
            .select("id, codigo, tipo, finalidade, rua, numero, bairro, cidade, quartos, banheiros, vagas, area_m2, valor_aluguel, valor_venda, condominio, iptu, fotos, vitrine_url");
          if (bairro) q = q.or(`bairro.ilike.%${bairro}%,cidade.ilike.%${bairro}%`);
          if (tipo) q = q.eq("tipo", tipo);
          if (finalidade) q = q.in("finalidade", [finalidade, "ambos"]);
          if (quartos_min != null) q = q.gte("quartos", quartos_min);
          const campoValor = finalidade === "venda" ? "valor_venda" : "valor_aluguel";
          if (valor_max != null) q = q.lte(campoValor, valor_max);
          if (valor_min != null) q = q.gte(campoValor, valor_min);
          const { data, error } = await q.order("created_at", { ascending: false }).limit(limite);
          if (error) return { erro: error.message, total: 0, imoveis: [] };
          return { total: data?.length ?? 0, imoveis: data ?? [], aviso_privacidade: "Dados do proprietário não são compartilhados." };
        },
      }),

      // ============ GESTÃO DE CHAVES (AÇÕES MUTATIVAS) ============
      // Usa o supabase do USUÁRIO AUTENTICADO (RLS + auth.uid()), nunca supabaseAdmin.
      // Os RPCs retirar_chave/devolver_chave já validam que quem devolve é quem retirou (ou admin).
      chave_buscar_imovel: tool({
        description: "Busca um imóvel por código (ex.: IM-0123), endereço ou bairro para identificar antes de retirar/devolver a chave. Retorna candidatos com o status atual da chave. SEMPRE use esta ferramenta antes de chamar chave_retirar/chave_devolver, e CONFIRME com o usuário qual imóvel é o correto antes de prosseguir.",
        inputSchema: z.object({
          codigo: z.string().optional().describe("Código do imóvel (ex.: IM-0123) — match exato ou parcial"),
          endereco: z.string().optional().describe("Trecho do endereço, rua, número ou bairro"),
          limite: z.number().int().min(1).max(10).default(5),
        }),
        execute: async ({ codigo, endereco, limite }) => {
          if (!codigo && !endereco) return { erro: "informe codigo ou endereco", imoveis: [] };
          let q = (context.supabase as unknown as SupabaseClient)
            .from("imoveis")
            .select("id, codigo, tipo, rua, numero, bairro, cidade, chave_com_id, chave_retirada_em");
          if (codigo) q = q.ilike("codigo", `%${codigo.trim()}%`);
          if (endereco) q = q.or(`rua.ilike.%${endereco}%,bairro.ilike.%${endereco}%,cidade.ilike.%${endereco}%`);
          const { data, error } = await q.limit(limite);
          if (error) return { erro: error.message, imoveis: [] };
          const ids = Array.from(new Set((data ?? []).map((d) => d.chave_com_id).filter((x): x is string => !!x)));
          const nomes = new Map<string, string>();
          if (ids.length) {
            const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", ids);
            (profs ?? []).forEach((p) => nomes.set(p.id, p.nome ?? ""));
          }
          return {
            total: data?.length ?? 0,
            imoveis: (data ?? []).map((d) => ({
              id: d.id,
              codigo: d.codigo,
              tipo: d.tipo,
              endereco: [d.rua, d.numero, d.bairro, d.cidade].filter(Boolean).join(", "),
              chave_disponivel: !d.chave_com_id,
              chave_com: d.chave_com_id ? (nomes.get(d.chave_com_id) || "outro corretor") : null,
              chave_retirada_em: d.chave_retirada_em,
            })),
          };
        },
      }),

      chave_retirar: tool({
        description: "Retira a chave de um imóvel em nome do USUÁRIO AUTENTICADO. Requer foto anexada na mensagem atual (a foto é obrigatória — sem foto, retorna erro). SEMPRE confirme o imóvel com o usuário ANTES de chamar.",
        inputSchema: z.object({
          imovel_id: z.string().uuid().describe("UUID do imóvel obtido via chave_buscar_imovel"),
          observacao: z.string().max(500).optional(),
          confirmado: z.literal(true).describe("Só passe true depois que o usuário confirmou explicitamente o imóvel."),
        }),
        execute: async ({ imovel_id, observacao }) => {
          if (!chavesAcoesHabilitado) return { erro: "Ações de chave estão desativadas nas Configurações." };
          if (!lastFotoPath) return { erro: "Anexe a foto da chave na mensagem antes de retirar." };
          const { data, error } = await (context.supabase as unknown as SupabaseClient)
            .rpc("retirar_chave", { _imovel_id: imovel_id, _foto_url: lastFotoPath, _observacao: observacao ?? null });
          if (error) return { erro: error.message };
          return { ok: true, log_id: data, mensagem: "Chave retirada com sucesso. Lembre-se de devolver depois da visita." };
        },
      }),

      chave_devolver: tool({
        description: "Devolve a chave de um imóvel. Só quem retirou (ou um admin) pode devolver. Requer foto anexada na mensagem atual. SEMPRE confirme o imóvel ANTES de chamar.",
        inputSchema: z.object({
          imovel_id: z.string().uuid(),
          observacao: z.string().max(500).optional(),
          confirmado: z.literal(true),
        }),
        execute: async ({ imovel_id, observacao }) => {
          if (!chavesAcoesHabilitado) return { erro: "Ações de chave estão desativadas nas Configurações." };
          if (!lastFotoPath) return { erro: "Anexe a foto da chave devolvida antes de prosseguir." };
          const { data, error } = await (context.supabase as unknown as SupabaseClient)
            .rpc("devolver_chave", { _imovel_id: imovel_id, _foto_url: lastFotoPath, _observacao: observacao ?? null });
          if (error) return { erro: error.message };
          return { ok: true, log_id: data, mensagem: "Chave devolvida com sucesso." };
        },
      }),

      // ============ CONFIRMAR VISITA ============
      visita_buscar: tool({
        description: "Lista visitas (pendentes de confirmação por padrão; futuras ou todas se pedido). Use para o usuário escolher qual confirmar. RLS limita ao escopo do usuário.",
        inputSchema: z.object({
          status: z.enum(["pendentes", "futuras", "todas"]).default("pendentes").describe("pendentes = passadas sem comparecimento; futuras = ainda não aconteceram"),
          limite: z.number().int().min(1).max(20).default(10),
        }),
        execute: async ({ status, limite }) => {
          const sup = context.supabase as unknown as SupabaseClient;
          let q = sup.from("vendas_visitas")
            .select("id, data_inicio, endereco, status, comparecimento, lead_id")
            .order("data_inicio", { ascending: false })
            .limit(limite);
          const now = new Date().toISOString();
          if (status === "pendentes") q = q.lt("data_inicio", now).is("comparecimento", null);
          else if (status === "futuras") q = q.gte("data_inicio", now);
          const { data, error } = await q;
          if (error) return { erro: error.message, visitas: [] };
          const leadIds = Array.from(new Set((data ?? []).map((v) => v.lead_id).filter((x): x is string => !!x)));
          const leadsMap = new Map<string, string>();
          if (leadIds.length) {
            const { data: ls } = await supabaseAdmin.from("vendas_leads").select("id, nome").in("id", leadIds);
            (ls ?? []).forEach((l) => leadsMap.set(l.id, l.nome ?? ""));
          }
          return {
            total: data?.length ?? 0,
            visitas: (data ?? []).map((v) => ({
              id: v.id, data_inicio: v.data_inicio, endereco: v.endereco,
              status: v.status, comparecimento: v.comparecimento,
              lead_nome: v.lead_id ? leadsMap.get(v.lead_id) ?? null : null,
            })),
          };
        },
      }),

      visita_confirmar: tool({
        description: "Marca uma visita como REALIZADA ou NAO_COMPARECEU. CONFIRME explicitamente (lead + data) antes de chamar. Só o corretor dono (ou admin) consegue — RLS valida.",
        inputSchema: z.object({
          visita_id: z.string().uuid(),
          comparecimento: z.enum(["realizada", "nao_compareceu"]),
          confirmado: z.literal(true),
        }),
        execute: async ({ visita_id, comparecimento }) => {
          const sup = context.supabase as unknown as SupabaseClient;
          const { error } = await sup
            .from("vendas_visitas")
            .update({
              comparecimento,
              confirmada_em: new Date().toISOString(),
              confirmada_por: context.userId,
              status: comparecimento === "realizada" ? "realizada" : "nao_compareceu",
            } as never)
            .eq("id", visita_id);
          if (error) return { erro: error.message };
          return { ok: true, mensagem: comparecimento === "realizada" ? "Visita marcada como realizada." : "Visita marcada como não comparecida." };
        },
      }),

      // ============ PLANTÃO (consulta + escala) ============
      plantao_consultar: tool({
        description: "Consulta a escala de plantão (próximos N dias, default 7; ou uma data específica). Retorna corretor escalado por dia.",
        inputSchema: z.object({
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          dias: z.number().int().min(1).max(31).default(7),
        }),
        execute: async ({ data: dataStr, dias }) => {
          const from = dataStr ?? new Date().toISOString().slice(0, 10);
          const fromDate = new Date(`${from}T00:00:00`);
          const toDate = new Date(fromDate);
          toDate.setDate(toDate.getDate() + (dataStr ? 1 : dias));
          const { data, error } = await supabaseAdmin
            .from("plantao_escala" as never)
            .select("data, corretor_id")
            .gte("data", from)
            .lt("data", toDate.toISOString().slice(0, 10));
          if (error) return { erro: error.message, escala: [] };
          const rows = (data ?? []) as { data: string; corretor_id: string }[];
          const ids = Array.from(new Set(rows.map((d) => d.corretor_id)));
          const nomes = new Map<string, string>();
          if (ids.length) {
            const { data: profs } = await supabaseAdmin.from("profiles").select("id, nome").in("id", ids);
            (profs ?? []).forEach((p) => nomes.set(p.id, p.nome ?? ""));
          }
          return { escala: rows.map((d) => ({ data: d.data, corretor_id: d.corretor_id, corretor_nome: nomes.get(d.corretor_id) ?? null })) };
        },
      }),

      plantao_definir: tool({
        description: "Escala um corretor como plantonista em uma data. Corretor só pode escalar a si mesmo em slot vazio; executivo, apenas dentro da própria equipe; admin pode tudo. Sempre CONFIRME (data + corretor) antes.",
        inputSchema: z.object({
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          corretor_id: z.string().uuid(),
          confirmado: z.literal(true),
        }),
        execute: async ({ data: dataStr, corretor_id }) => {
          if (scope.tipo === "corretor" && corretor_id !== scope.userId) return { erro: "Você só pode se escalar a si mesmo." };
          const { data: prevRaw } = await supabaseAdmin.from("plantao_escala" as never).select("corretor_id").eq("data", dataStr).maybeSingle();
          const prev = prevRaw as { corretor_id: string } | null;
          if (scope.tipo === "corretor" && prev && prev.corretor_id !== scope.userId) return { erro: "Você não pode alterar a escala de outra pessoa." };
          if (scope.tipo === "executivo" && prev && prev.corretor_id !== scope.userId && prev.corretor_id !== corretor_id) {
            if (!scope.corretorIds.includes(prev.corretor_id)) return { erro: "Apenas Admin pode alterar escala fora da sua equipe." };
          }
          const { error } = await supabaseAdmin.from("plantao_escala" as never).upsert({
            data: dataStr, corretor_id, criado_por: context.userId,
            ...(prev?.corretor_id !== corretor_id ? { notificado_em: null } : {}),
          } as never, { onConflict: "data" });
          if (error) return { erro: error.message };
          return { ok: true, mensagem: `Plantão de ${dataStr} definido.` };
        },
      }),

      plantao_remover: tool({
        description: "Remove a escala de plantão de uma data. Mesmas regras de permissão de plantao_definir. Sempre CONFIRME antes.",
        inputSchema: z.object({
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          confirmado: z.literal(true),
        }),
        execute: async ({ data: dataStr }) => {
          const { data: prevRaw } = await supabaseAdmin.from("plantao_escala" as never).select("corretor_id").eq("data", dataStr).maybeSingle();
          const prev = prevRaw as { corretor_id: string } | null;
          if (!prev) return { ok: true, mensagem: "Dia já estava sem escala." };
          if (scope.tipo === "corretor" && prev.corretor_id !== scope.userId) return { erro: "Você só pode se remover do plantão." };
          if (scope.tipo === "executivo" && prev.corretor_id !== scope.userId && !scope.corretorIds.includes(prev.corretor_id)) {
            return { erro: "Apenas Admin pode remover escala fora da sua equipe." };
          }
          const { error } = await supabaseAdmin.from("plantao_escala" as never).delete().eq("data", dataStr);
          if (error) return { erro: error.message };
          return { ok: true, mensagem: `Escala de ${dataStr} removida.` };
        },
      }),

      // ============ METAS ============
      meta_consultar: tool({
        description: "Consulta meta mensal de um corretor (ou de toda a equipe, se corretor_id omitido). Corretor vê só a própria; executivo, da equipe; admin, todos.",
        inputSchema: z.object({
          corretor_id: z.string().uuid().optional(),
          ano: z.number().int().min(2024).max(2100),
          mes: z.number().int().min(1).max(12),
        }),
        execute: async ({ corretor_id, ano, mes }) => {
          if (scope.tipo === "corretor" && corretor_id && corretor_id !== scope.userId) return { erro: "Você só pode consultar a própria meta." };
          let q = supabaseAdmin.from("metas_mensais").select("corretor_id, ano, mes, meta_vendas, meta_locacoes, meta_receita, meta_leads_atendidos").eq("ano", ano).eq("mes", mes);
          if (corretor_id) q = q.eq("corretor_id", corretor_id);
          else if (scope.tipo === "executivo") q = q.in("corretor_id", [scope.userId, ...scope.corretorIds]);
          else if (scope.tipo === "corretor") q = q.eq("corretor_id", scope.userId);
          const { data, error } = await q;
          if (error) return { erro: error.message, metas: [] };
          return { total: data?.length ?? 0, metas: data ?? [] };
        },
      }),

      meta_definir: tool({
        description: "Define/atualiza a meta mensal de um corretor. APENAS ADMIN. CONFIRME (corretor, mês, valores) antes. Dispara push automático.",
        inputSchema: z.object({
          corretor_id: z.string().uuid(),
          ano: z.number().int().min(2024).max(2100),
          mes: z.number().int().min(1).max(12),
          meta_vendas: z.number().int().min(0).max(9999),
          meta_locacoes: z.number().int().min(0).max(9999),
          meta_receita: z.number().min(0).max(1_000_000_000),
          meta_leads_atendidos: z.number().int().min(0).max(9999),
          confirmado: z.literal(true),
        }),
        execute: async ({ corretor_id, ano, mes, meta_vendas, meta_locacoes, meta_receita, meta_leads_atendidos }) => {
          if (scope.tipo !== "admin") return { erro: "Apenas Admin pode definir metas." };
          const { data: existente } = await supabaseAdmin.from("metas_mensais").select("id")
            .eq("corretor_id", corretor_id).eq("ano", ano).eq("mes", mes).maybeSingle();
          const isUpdate = !!existente;
          const { error } = await supabaseAdmin.from("metas_mensais").upsert(
            { corretor_id, ano, mes, meta_vendas, meta_locacoes, meta_receita, meta_leads_atendidos },
            { onConflict: "corretor_id,ano,mes" },
          );
          if (error) return { erro: error.message };
          try {
            const { data: prof } = await supabaseAdmin.from("profiles").select("onesignal_external_id").eq("id", corretor_id).maybeSingle();
            const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
            if (ext) {
              const { sendOneSignalPush } = await import("@/lib/onesignal.server");
              await sendOneSignalPush({
                externalIds: [ext],
                title: isUpdate ? "Sua meta deste mês foi atualizada" : "Você recebeu uma meta este mês",
                message: `${meta_vendas + meta_locacoes} vendas/locações`,
                url: "/vendas/metas",
                data: { tipo: "meta_definida", ano, mes },
              });
            }
          } catch (e) { console.warn("[meta_definir] push falhou", e); }
          return { ok: true, isUpdate, mensagem: isUpdate ? "Meta atualizada." : "Meta criada." };
        },
      }),

      // ============ FINANCIAMENTO ============
      financiamento_consultar_lead: tool({
        description: "Consulta o financiamento vinculado a um lead (se houver). RLS limita ao escopo do usuário.",
        inputSchema: z.object({ lead_id: z.string().uuid() }),
        execute: async ({ lead_id }) => {
          const sup = context.supabase as unknown as SupabaseClient;
          const { data, error } = await sup.from("financiamentos")
            .select("id, status, observacao, nome, imovel_endereco, imovel_valor, created_at")
            .eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (error) return { erro: error.message };
          return { financiamento: data ?? null };
        },
      }),

      financiamento_listar: tool({
        description: "Lista financiamentos (Admin ou Correspondente Bancária). Filtro opcional por status.",
        inputSchema: z.object({
          status: z.enum(["pendente", "em_analise", "aprovado", "recusado"]).optional(),
          limite: z.number().int().min(1).max(50).default(20),
        }),
        execute: async ({ status, limite }) => {
          const sup = context.supabase as unknown as SupabaseClient;
          const { data: isCorresp } = await sup.rpc("is_correspondente_bancaria", { _user_id: context.userId });
          if (scope.tipo !== "admin" && !isCorresp) return { erro: "Acesso restrito a Admin/Correspondente." };
          let q = supabaseAdmin.from("financiamentos" as never)
            .select("id, nome, telefone, status, imovel_endereco, imovel_valor, created_at, lead_id")
            .order("created_at", { ascending: false }).limit(limite);
          if (status) q = q.eq("status", status);
          const { data, error } = await q;
          if (error) return { erro: error.message, financiamentos: [] };
          return { total: data?.length ?? 0, financiamentos: data ?? [] };
        },
      }),

      financiamento_atualizar_status: tool({
        description: "Atualiza status do financiamento. APENAS Admin ou Correspondente. CONFIRME (qual financiamento + novo status) antes. Push automático em aprovado/recusado.",
        inputSchema: z.object({
          id: z.string().uuid(),
          status: z.enum(["pendente", "em_analise", "aprovado", "recusado"]),
          observacao: z.string().max(2000).optional(),
          confirmado: z.literal(true),
        }),
        execute: async ({ id, status, observacao }) => {
          const sup = context.supabase as unknown as SupabaseClient;
          const { data: isCorresp } = await sup.rpc("is_correspondente_bancaria", { _user_id: context.userId });
          if (scope.tipo !== "admin" && !isCorresp) return { erro: "Acesso restrito a Admin/Correspondente." };
          const { data: prev } = await supabaseAdmin.from("financiamentos" as never).select("status, lead_id, nome").eq("id", id).maybeSingle();
          const { error } = await supabaseAdmin.from("financiamentos" as never)
            .update({ status, observacao: observacao || null, updated_by: context.userId } as never).eq("id", id);
          if (error) return { erro: error.message };
          const prevRow = prev as { status: string; lead_id: string | null; nome: string } | null;
          if (prevRow && prevRow.status !== status && (status === "aprovado" || status === "recusado")) {
            try {
              const dest = new Set<string>();
              if (prevRow.lead_id) {
                const { data: lr } = await supabaseAdmin.from("vendas_leads").select("atribuido_por, corretor_id").eq("id", prevRow.lead_id).maybeSingle();
                const l = lr as { atribuido_por: string | null; corretor_id: string | null } | null;
                if (l?.atribuido_por) dest.add(l.atribuido_por);
                if (l?.corretor_id) dest.add(l.corretor_id);
              }
              const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
              ((admins ?? []) as { user_id: string }[]).forEach((a) => dest.add(a.user_id));
              if (dest.size) {
                const { data: profs } = await supabaseAdmin.from("profiles").select("onesignal_external_id").in("id", Array.from(dest));
                const ext = ((profs ?? []) as { onesignal_external_id: string | null }[]).map((p) => p.onesignal_external_id).filter((x): x is string => !!x);
                if (ext.length) {
                  const { sendOneSignalPush } = await import("@/lib/onesignal.server");
                  await sendOneSignalPush({
                    externalIds: ext,
                    title: status === "aprovado" ? "Financiamento aprovado" : "Financiamento recusado",
                    message: `${prevRow.nome}: ${status}${observacao ? ` — ${observacao}` : ""}`,
                    url: "https://sistemanexus.app/correspondente",
                    data: { financiamento_id: id, status },
                  });
                }
              }
            } catch (e) { console.warn("[financiamento_atualizar_status] push falhou", e); }
          }
          return { ok: true, mensagem: `Financiamento atualizado para ${status}.` };
        },
      }),

      // ============ ATRIBUIÇÃO DE LEAD ============
      // Admin: qualquer lead → qualquer corretor.
      // Executivo: apenas leads da própria equipe → corretores da própria equipe (mesma regra do pipeline de Vendas).
      // Corretor: sem acesso.
      lead_atribuir_plantonista: tool({
        description: "Atribui um lead de vendas ao plantonista de uma data (default = hoje). Admin (qualquer lead) ou Executivo (apenas dentro da própria equipe). CONFIRME antes. Dispara push para o corretor.",
        inputSchema: z.object({
          lead_id: z.string().uuid(),
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          confirmado: z.literal(true),
        }),
        execute: async ({ lead_id, data: dataStr }) => {
          if (scope.tipo !== "admin" && scope.tipo !== "executivo") return { erro: "Apenas Admin ou Executivo podem atribuir leads." };
          const hoje = dataStr ?? new Date().toISOString().slice(0, 10);
          const { data: esc } = await supabaseAdmin.from("plantao_escala" as never).select("corretor_id").eq("data", hoje).maybeSingle();
          const corretorId = (esc as { corretor_id: string } | null)?.corretor_id;
          if (!corretorId) return { erro: `Não há plantonista escalado em ${hoje}.` };
          const guard = await validarEscopoAtribuicao(lead_id, corretorId);
          if (guard) return guard;
          return await atribuirLeadInline(lead_id, corretorId);
        },
      }),

      lead_atribuir_corretor: tool({
        description: "Atribui um lead de vendas a um corretor específico. Admin (qualquer lead → qualquer corretor) ou Executivo (apenas leads da própria equipe → corretores da própria equipe). Use listar_corretores_disponiveis para descobrir IDs. CONFIRME antes.",
        inputSchema: z.object({
          lead_id: z.string().uuid(),
          corretor_id: z.string().uuid(),
          confirmado: z.literal(true),
        }),
        execute: async ({ lead_id, corretor_id }) => {
          if (scope.tipo !== "admin" && scope.tipo !== "executivo") return { erro: "Apenas Admin ou Executivo podem atribuir leads." };
          const guard = await validarEscopoAtribuicao(lead_id, corretor_id);
          if (guard) return guard;
          return await atribuirLeadInline(lead_id, corretor_id);
        },
      }),
    };

    // Executivo só atribui leads da própria equipe para corretores da própria equipe (inclui ele mesmo).
    async function validarEscopoAtribuicao(leadId: string, corretorId: string): Promise<{ erro: string } | null> {
      if (scope.tipo !== "executivo") return null;
      const equipe = new Set<string>([scope.userId, ...scope.corretorIds]);
      if (!equipe.has(corretorId)) {
        return { erro: "Como Executivo, você só pode atribuir leads a corretores da sua equipe." };
      }
      const { data: leadRaw } = await supabaseAdmin
        .from("vendas_leads").select("corretor_id").eq("id", leadId).maybeSingle();
      const atual = (leadRaw as { corretor_id: string | null } | null)?.corretor_id ?? null;
      if (atual && !equipe.has(atual)) {
        return { erro: "Esse lead pertence a outra equipe. Apenas Admin pode reatribuí-lo." };
      }
      return null;
    }

    // Helper para as duas tools de atribuição (mesma lógica de atribuirLead em vendas-distribuicao)
    async function atribuirLeadInline(leadId: string, corretorId: string) {
      const { data: updated, error } = await supabaseAdmin
        .from("vendas_leads")
        .update({
          corretor_id: corretorId,
          atribuicao_status: "pendente",
          atribuido_em: new Date().toISOString(),
          atribuido_por: context.userId,
        } as never)
        .eq("id", leadId)
        .select("nome, telefone, regiao")
        .single();
      if (error) return { erro: error.message };
      try {
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("onesignal_external_id").eq("id", corretorId).maybeSingle();
        const ext = (prof as { onesignal_external_id: string | null } | null)?.onesignal_external_id;
        if (ext) {
          const lead = updated as { nome: string; telefone: string; regiao: string };
          const { sendOneSignalPush } = await import("@/lib/onesignal.server");
          await sendOneSignalPush({
            externalId: ext,
            title: "🏠 Novo Lead Atribuído!",
            message: `${lead.nome} · ${lead.telefone} · ${lead.regiao.replace(/_/g, " ")}`,
            url: "https://sistemanexus.app/vendas/leads",
            data: { lead_id: leadId },
          });
        }
      } catch (e) { console.warn("[lead_atribuir] push falhou", e); }
      return { ok: true, mensagem: "Lead atribuído com sucesso." };
    }

    const escopoTexto =
      scope.tipo === "admin"
        ? `Você está conversando com um ADMINISTRADOR (${scope.nome}). Acesso total, incluindo o MÓDULO ADMINISTRATIVO (imóveis, contratos, pagamentos, inadimplentes, documentos, receita, vendas).`
        : scope.tipo === "administrativo"
        ? `Você está conversando com o PERFIL ADMINISTRATIVO (${scope.nome}). Acesso total ao MÓDULO ADMINISTRATIVO (imóveis, contratos, pagamentos, inadimplentes, documentos, receita, vendas) e aos pipelines de vendas/captação para consulta.`
        : scope.tipo === "executivo"
        ? `Você está conversando com a EXECUTIVA/EXECUTIVO ${scope.responsavelNome} (região: ${scope.regiao ?? "n/a"}). Acesso APENAS à própria equipe (${scope.corretorIds.length} corretor(es)) e aos próprios leads. NUNCA revele dados de outros executivos ou de corretores de outra equipe. SEM acesso ao módulo Administrativo.`
        : `Você está conversando com um CORRETOR (${scope.nome}). Acesso APENAS aos próprios leads, agenda e métricas. NUNCA revele dados de outros corretores ou executivos. SEM acesso ao módulo Administrativo.`;

    const bloqueioAdministrativo =
      scope.tipo === "admin" || scope.tipo === "administrativo"
        ? ""
        : `\n\n🚫 BLOQUEIO TOTAL DO MÓDULO ADMINISTRATIVO:
- Você NÃO TEM, em hipótese alguma, acesso a: contratos, pagamentos, inadimplentes, cobranças, receita, documentos administrativos, locatários, PROPRIETÁRIOS (nome, CPF, telefone, e-mail), comissões, ou qualquer outro dado financeiro/contratual do módulo Administrativo.
- Se perguntarem QUALQUER coisa relacionada (mesmo de forma indireta, disfarçada ou genérica como "receita", "inadimplência", "contrato vencendo", "documentos do locatário", "quem é o dono do imóvel"), responda EXATAMENTE: "Esse assunto não está dentro das minhas atribuições para o seu perfil"
- NÃO chame as ferramentas com prefixo admin_*. Elas retornarão erro se chamadas.

✅ EXCEÇÃO ESPECÍFICA — PORTFÓLIO DE IMÓVEIS DISPONÍVEIS:
- Você PODE consultar imóveis DISPONÍVEIS para locação/venda usando a ferramenta **portfolio_buscar_imoveis** para ajudar corretores/executivos a oferecer imóveis aos seus leads.
- Exemplos liberados: "temos apartamento na Barra por até R$ 2.500?", "quais imóveis disponíveis em Recreio?", "tem casa com 3 quartos pra venda?".
- Retorne APENAS os dados públicos do imóvel: código, endereço, tipo, finalidade, valor, quartos/banheiros/vagas, área, fotos, vitrine.
- **NUNCA** revele dados do proprietário, contrato vinculado, locatário atual, ou qualquer informação financeira/administrativa do imóvel — mesmo se perguntado diretamente.`;

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
Se perguntarem sobre corretor fora do seu escopo: "Não tenho autorização para compartilhar informações de outros corretores."${bloqueioAdministrativo}`;

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

🔀 DOIS PIPELINES DISTINTOS — NUNCA MISTURE:

**A) PIPELINE DE CAPTAÇÃO DE CORRETORES** (gerido pelos EXECUTIVOS)
- Sobre quem: pessoas que querem **trabalhar como corretor** no time.
- Etapas: Novos Leads → Em Atendimento → Reunião Agendada → Fechado → Descartado.
- Palavras-chave: "corretor", "captação", "recrutamento", "time", "equipe", "recrutar".
- Ferramentas: captacao_contar_leads, captacao_buscar_lead, captacao_relatorio.

**B) PIPELINE DE VENDAS DE IMÓVEIS** (gerido pelos CORRETORES)
- Sobre quem: clientes que querem **comprar ou alugar imóvel**.
- Etapas: Novo Lead → Contato Realizado → Visita Agendada → Proposta → Negociação → Fechado.
- Palavras-chave: "venda", "aluguel", "imóvel", "compra", "locação", "cliente".
- Ferramentas: contar_leads, buscar_lead, relatorio_rapido.

REGRAS DE PIPELINE:
- Se a pergunta for **ambígua** ("quantos leads chegaram hoje?", "como está o pipeline?"), faça UMA de duas coisas:
  (a) pergunte rapidamente: "Você quer ver **captação de corretores** ou **vendas de imóveis**?", OU
  (b) chame AMBAS as ferramentas e responda separado: "📋 **Captação:** X leads novos hoje | 🏠 **Vendas:** Y leads novos hoje".
- Se a pergunta deixa claro o pipeline, chame só a ferramenta correta e **identifique a fonte** no início ("No pipeline de **vendas**, ...").
- **NUNCA** misture números dos dois pipelines no mesmo total sem rotular cada um.

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
- Nunca apenas despeje os números crus: sempre interprete.

🔑 GESTÃO DE CHAVES (${chavesAcoesHabilitado ? "HABILITADA" : "DESABILITADA pelas Configurações"})
${chavesAcoesHabilitado ? `Quando o usuário pedir para **retirar** ou **devolver a chave** de um imóvel:
1. Verifique se ele anexou a **foto da chave**. Se não anexou, peça a foto ANTES de qualquer ação. Status da foto neste turno: ${lastFotoPath ? "✅ foto recebida" : "❌ nenhuma foto anexada"}.
2. Pergunte/identifique o imóvel: peça **código** (ex.: IM-0123) ou **endereço**. NÃO tente adivinhar pela foto — placa/fachada não é prova suficiente.
3. Chame **chave_buscar_imovel** com o código/endereço informado e mostre os candidatos com endereço completo e status atual da chave.
4. **CONFIRME explicitamente** com o usuário: "Confirma retirar/devolver a chave do imóvel **IM-XXXX — Rua Tal, 123, Bairro**?". Só prossiga após o "sim".
5. Com a confirmação, chame **chave_retirar** ou **chave_devolver** passando \`confirmado: true\` e o \`imovel_id\` retornado.
6. Se o RPC retornar erro ("chave já está com outro corretor", "somente quem retirou pode devolver"), explique de forma simples ao usuário o que fazer.` : "Se o usuário pedir para retirar/devolver chave, responda que essa ação está desativada e que ele deve usar o módulo de Chaves no app ou pedir ao Admin para habilitar a integração no chat."}

📅 CONFIRMAR VISITA
Quando o usuário pedir para **confirmar visita** / marcar comparecimento:
1. Chame **visita_buscar** (pendentes por padrão) e mostre as opções (lead + data + endereço).
2. CONFIRME qual visita e qual desfecho ("Confirmo que a visita do **Fulano** em **DD/MM HH:MM** foi realizada / não compareceu?").
3. Só depois do "sim" chame **visita_confirmar** com \`confirmado: true\`.

🗓️ PLANTÃO (consultar e escalar)
- Para consultar quem está de plantão: **plantao_consultar** (default 7 dias).
- Para escalar/trocar/remover: **plantao_definir** / **plantao_remover**. SEMPRE confirme a data e o corretor antes. Lembre que corretor só pode escalar a si mesmo; executivo só dentro da própria equipe; admin pode tudo.

🎯 METAS
- **meta_consultar** para ver metas do mês (qualquer perfil, dentro do escopo).
- **meta_definir** APENAS para Admin. Confirme corretor, mês/ano e cada valor (vendas, locações, receita, leads atendidos) antes de chamar com \`confirmado: true\`.

💰 FINANCIAMENTO
- **financiamento_consultar_lead** para ver o status de um lead específico (qualquer perfil com acesso ao lead).
- **financiamento_listar** + **financiamento_atualizar_status** restritos a Admin/Correspondente. Sempre confirme o financiamento e o novo status (pendente / em_analise / aprovado / recusado) antes de aplicar.

🎲 ATRIBUIÇÃO DE LEAD (Admin)
- **lead_atribuir_plantonista** atribui ao plantonista do dia (ou de outra data).
- **lead_atribuir_corretor** atribui a um corretor específico (use **listar_corretores_disponiveis** se precisar do ID).
- SEMPRE diga em texto qual é o lead, qual é o corretor identificado e peça confirmação. Só com "sim" chame a tool com \`confirmado: true\`.`,
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
      scope.tipo === "admin" || scope.tipo === "administrativo" ? "todos" :
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
