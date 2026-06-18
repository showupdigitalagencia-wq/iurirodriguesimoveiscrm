-- Normalize legacy 'disponivel' rows to 'disponivel_locacao'
UPDATE public.imoveis SET status = 'disponivel_locacao' WHERE status = 'disponivel';

-- Replace status check constraint to include locacao/venda split
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_status_check;
ALTER TABLE public.imoveis ADD CONSTRAINT imoveis_status_check
  CHECK (status = ANY (ARRAY[
    'disponivel_locacao'::text,
    'disponivel_venda'::text,
    'locado'::text,
    'vendido'::text,
    'manutencao'::text,
    'rescindido'::text
  ]));