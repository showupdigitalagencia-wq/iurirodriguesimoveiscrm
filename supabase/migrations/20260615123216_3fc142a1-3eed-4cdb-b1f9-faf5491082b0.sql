
ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS atribuicao_status text,
  ADD COLUMN IF NOT EXISTS atribuido_em timestamptz,
  ADD COLUMN IF NOT EXISTS atribuido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recusas jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vendas_leads
  DROP CONSTRAINT IF EXISTS vendas_leads_atribuicao_status_check;
ALTER TABLE public.vendas_leads
  ADD CONSTRAINT vendas_leads_atribuicao_status_check
  CHECK (atribuicao_status IS NULL OR atribuicao_status IN ('pendente','aceito','recusado'));

CREATE INDEX IF NOT EXISTS idx_vendas_leads_atribuicao ON public.vendas_leads(atribuicao_status);
