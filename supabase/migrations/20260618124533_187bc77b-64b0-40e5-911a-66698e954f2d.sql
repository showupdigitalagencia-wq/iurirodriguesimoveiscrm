ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS finalidade text NOT NULL DEFAULT 'locacao';

ALTER TABLE public.imoveis
  DROP CONSTRAINT IF EXISTS imoveis_finalidade_check;
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_finalidade_check
  CHECK (finalidade IN ('locacao','venda','ambos'));

ALTER TABLE public.imoveis
  ALTER COLUMN valor_aluguel DROP NOT NULL;
ALTER TABLE public.imoveis
  ALTER COLUMN valor_aluguel SET DEFAULT 0;