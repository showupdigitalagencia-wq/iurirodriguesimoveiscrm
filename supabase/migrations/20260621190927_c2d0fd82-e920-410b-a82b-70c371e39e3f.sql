
-- Portfólio público de imóveis disponíveis: view sanitizada, SEM dados do proprietário,
-- visível a TODOS os usuários autenticados (corretores, executivos, admin, administrativo).
-- A view roda como o owner (security definer view) e expõe apenas linhas com status disponível.

CREATE OR REPLACE VIEW public.imoveis_portfolio AS
SELECT
  i.id,
  i.codigo,
  i.tipo,
  i.finalidade,
  i.status,
  i.rua,
  i.numero,
  i.complemento,
  i.bairro,
  i.cidade,
  i.cep,
  i.quartos,
  i.banheiros,
  i.vagas,
  i.area_m2,
  i.valor_aluguel,
  i.valor_venda,
  i.condominio,
  i.iptu,
  i.fotos,
  i.observacoes,
  i.vitrine_url,
  i.created_at,
  i.updated_at
FROM public.imoveis i
WHERE i.status IN ('disponivel', 'disponivel_locacao', 'disponivel_venda');

-- Garantir acesso de leitura a todos os usuários autenticados.
REVOKE ALL ON public.imoveis_portfolio FROM PUBLIC;
GRANT SELECT ON public.imoveis_portfolio TO authenticated;
GRANT SELECT ON public.imoveis_portfolio TO service_role;
