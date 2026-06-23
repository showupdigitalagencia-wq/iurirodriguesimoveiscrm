ALTER TABLE public.vendas_leads ADD COLUMN IF NOT EXISTS followup_alerta_em timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS followup_alerta_em timestamptz;