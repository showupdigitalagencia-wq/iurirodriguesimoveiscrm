
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reativacao_sugerida_em timestamptz;

ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS reativacao_sugerida_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_reativacao_pendente
  ON public.leads(updated_at)
  WHERE etapa = 'descartado' AND reativacao_sugerida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_leads_reativacao_pendente
  ON public.vendas_leads(updated_at)
  WHERE etapa = 'perdido' AND reativacao_sugerida_em IS NULL;

INSERT INTO public.configuracoes (chave, valor)
VALUES ('lead_reativacao_dias', '60'::jsonb)
ON CONFLICT (chave) DO NOTHING;
