import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImovelFechamentoOption = {
  id: string;
  codigo: string | null;
  tipo: string;
  finalidade: string;
  bairro: string | null;
  valor_venda: number | null;
  valor_aluguel: number | null;
};

export const listImoveisParaFechamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { finalidade?: "venda" | "locacao" }) => input)
  .handler(async ({ context }) => {
    // Usa a view sanitizada `imoveis_portfolio` para que corretores e executivos
    // (sem SELECT direto em `imoveis`) também consigam listar opções de fechamento.
    const { data: rows, error } = await context.supabase
      .from("imoveis_portfolio" as never)
      .select("id, codigo, tipo, finalidade, bairro, valor_venda, valor_aluguel")
      .order("codigo", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as unknown as ImovelFechamentoOption[] };
  });

export const fecharLeadVendas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lead_id: string; imovel_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rpc, error } = await context.supabase.rpc("fechar_lead_vendas" as never, {
      _lead_id: data.lead_id,
      _imovel_id: data.imovel_id,
    } as never);
    if (error) throw new Error(error.message);
    return rpc as { ok: boolean; comissao: number; lead_id: string; imovel_id: string };
  });

export type ReceitaAdministracao = {
  contratos_ativos: number;
  aluguel_total_mensal: number;
  taxa: number;
  receita_mensal: number;
  receita_periodo: number;
  meses_periodo: number;
};

export const getReceitaAdministracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rpc, error } = await context.supabase.rpc("get_receita_administracao" as never, {
      _from: data.from,
      _to: data.to,
    } as never);
    if (error) throw new Error(error.message);
    return rpc as unknown as ReceitaAdministracao;
  });
