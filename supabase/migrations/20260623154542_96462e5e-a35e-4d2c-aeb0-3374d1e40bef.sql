ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS chave_atraso_notificado_em timestamptz;

ALTER TABLE public.vendas_visitas
  ADD COLUMN IF NOT EXISTS chave_lembrete_enviado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendas_visitas_data_inicio_futura
  ON public.vendas_visitas(data_inicio)
  WHERE chave_lembrete_enviado_em IS NULL;