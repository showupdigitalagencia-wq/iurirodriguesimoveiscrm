
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS data_locacao date,
  ADD COLUMN IF NOT EXISTS corretor_fechamento_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS executivo_fechamento_id uuid REFERENCES public.responsaveis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_data_venda ON public.imoveis(data_venda);
CREATE INDEX IF NOT EXISTS idx_imoveis_data_locacao ON public.imoveis(data_locacao);
CREATE INDEX IF NOT EXISTS idx_imoveis_corretor_fechamento ON public.imoveis(corretor_fechamento_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_executivo_fechamento ON public.imoveis(executivo_fechamento_id);
