DROP VIEW IF EXISTS public.imoveis_portfolio;
CREATE VIEW public.imoveis_portfolio AS
SELECT id, codigo, tipo, finalidade, status, rua, numero, complemento, bairro, cidade, cep,
  quartos, banheiros, vagas, area_m2, valor_aluguel, valor_venda, condominio, iptu,
  fotos, observacoes, vitrine_url, captador_id, gestao_patrimonio,
  chave_com_id, chave_retirada_em, chave_foto_atual,
  created_at, updated_at
FROM public.imoveis i
WHERE status = ANY (ARRAY['disponivel'::text, 'disponivel_locacao'::text, 'disponivel_venda'::text]);

GRANT SELECT ON public.imoveis_portfolio TO authenticated;