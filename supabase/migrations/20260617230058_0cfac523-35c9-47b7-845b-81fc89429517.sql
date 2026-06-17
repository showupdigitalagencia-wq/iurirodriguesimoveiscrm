ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_status_check;
ALTER TABLE public.imoveis ADD CONSTRAINT imoveis_status_check CHECK (status = ANY (ARRAY['disponivel'::text, 'locado'::text, 'manutencao'::text, 'rescindido'::text, 'vendido'::text]));
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS data_venda DATE;
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(12,2);