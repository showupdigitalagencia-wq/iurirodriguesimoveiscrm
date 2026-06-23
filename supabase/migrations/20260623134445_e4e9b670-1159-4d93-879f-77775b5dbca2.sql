
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS captador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gestao_patrimonio boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_imoveis_captador ON public.imoveis(captador_id);

DROP VIEW IF EXISTS public.imoveis_portfolio;
CREATE VIEW public.imoveis_portfolio AS
SELECT id, codigo, tipo, finalidade, status, rua, numero, complemento, bairro, cidade, cep,
  quartos, banheiros, vagas, area_m2, valor_aluguel, valor_venda, condominio, iptu,
  fotos, observacoes, vitrine_url, captador_id, gestao_patrimonio, created_at, updated_at
FROM public.imoveis i
WHERE status = ANY (ARRAY['disponivel'::text, 'disponivel_locacao'::text, 'disponivel_venda'::text]);

GRANT SELECT ON public.imoveis_portfolio TO authenticated;
