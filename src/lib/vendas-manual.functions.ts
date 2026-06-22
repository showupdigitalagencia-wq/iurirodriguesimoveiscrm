import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Log de origem da atribuição
    const detalhe =
      atribuicaoTipo === "admin_manual"
        ? { mensagem: "Lead manual atribuído manualmente por administrador", criado_por: context.userId }
        : atribuicaoTipo === "plantao_auto"
          ? { mensagem: "Lead manual atribuído automaticamente ao plantonista do dia", criado_por: context.userId }
          : { mensagem: "Lead manual cadastrado sem plantonista do dia", criado_por: context.userId };

    await supabaseAdmin.from("plantao_log" as never).insert({
      lead_id: vlead.id,
      corretor_id: corretorId,
      motivo: corretorId ? "novo_lead" : "sem_plantonista",
      origem: "manual",
      detalhe: detalhe as never,
    } as never);

    return { id: vlead.id as string, corretor_id: corretorId, atribuicao: atribuicaoTipo };
  });
