import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhoneBR } from "@/lib/phone";


const InputSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(1),
  email: z.string().nullable().optional(),
  tipo: z.enum(["compra", "locacao"]),
  regiao: z.string().min(1),
  valor: z.number().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  etapa: z.string().min(1),
  // Apenas admins podem informar — para os demais é ignorado.
  corretor_id_override: z.string().uuid().nullable().optional(),
});

function brtTodayISO(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}-${String(brt.getUTCDate()).padStart(2, "0")}`;
}

export const createManualVendasLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Role do solicitante
    const { data: isAdminRaw } = await (context.supabase as unknown as {
      rpc: (n: string, a: unknown) => Promise<{ data: boolean | null }>;
    }).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const isAdmin = !!isAdminRaw;

    // Plantonista do dia (Brasília)
    const hoje = brtTodayISO();
    const { data: escala } = await supabaseAdmin
      .from("plantao_escala" as never)
      .select("corretor_id")
      .eq("data", hoje)
      .maybeSingle();
    const plantonista = (escala as { corretor_id: string } | null)?.corretor_id ?? null;

    // Resolve atribuição final
    let corretorId: string | null;
    let atribuicaoTipo: "plantao_auto" | "admin_manual" | "sem_plantonista";

    if (isAdmin && data.corretor_id_override) {
      corretorId = data.corretor_id_override;
      atribuicaoTipo = corretorId === plantonista ? "plantao_auto" : "admin_manual";
    } else {
      corretorId = plantonista;
      atribuicaoTipo = plantonista ? "plantao_auto" : "sem_plantonista";
    }

    const nowIso = new Date().toISOString();

    // Inserção do lead (via admin para garantir consistência com plantao_log)
    const { data: vlead, error: vlErr } = await supabaseAdmin
      .from("vendas_leads")
      .insert({
        nome: data.nome.trim(),
        telefone: data.telefone.replace(/\D/g, ""),
        email: data.email?.trim() || null,
        tipo: data.tipo as never,
        regiao: data.regiao as never,
        valor: data.valor ?? null,
        observacoes: data.observacoes?.trim() || null,
        etapa: data.etapa as never,
        corretor_id: corretorId,
        created_by: context.userId,
        origem: "manual" as never,
        plantao_dia: hoje,
        atribuicao_status: corretorId ? "pendente" : null,
        atribuido_em: corretorId ? nowIso : null,
        atribuido_por: corretorId ? context.userId : null,
      } as never)
      .select("id")
      .single();
    if (vlErr || !vlead) throw new Error(vlErr?.message ?? "Falha ao cadastrar lead");

    // Resolve nomes para o histórico (rastreabilidade)
    const idsParaNome = Array.from(new Set([context.userId, ...(corretorId ? [corretorId] : [])]));
    const { data: profsRaw } = await supabaseAdmin
      .from("profiles").select("id, nome").in("id", idsParaNome);
    const nomes = new Map<string, string>(
      ((profsRaw ?? []) as { id: string; nome: string | null }[]).map((p) => [p.id, p.nome ?? ""]),
    );
    const criadoPorNome = nomes.get(context.userId) ?? null;
    const atribuidoNome = corretorId ? (nomes.get(corretorId) ?? null) : null;

    const mensagem =
      atribuicaoTipo === "admin_manual"
        ? "Lead manual atribuído manualmente por administrador"
        : atribuicaoTipo === "plantao_auto"
          ? "Lead manual atribuído automaticamente ao plantonista do dia"
          : "Lead manual criado sem plantonista definido (fallback)";

    const detalhe = {
      mensagem,
      motivo: atribuicaoTipo,
      criado_por: { id: context.userId, nome: criadoPorNome },
      atribuido_a: corretorId ? { id: corretorId, nome: atribuidoNome } : null,
      atribuido_em: nowIso,
    };

    await supabaseAdmin.from("plantao_log" as never).insert({
      lead_id: vlead.id,
      corretor_id: corretorId,
      motivo: corretorId ? "novo_lead" : "sem_plantonista",
      origem: "manual",
      detalhe: detalhe as never,
    } as never);

    return { id: vlead.id as string, corretor_id: corretorId, atribuicao: atribuicaoTipo };
  });
