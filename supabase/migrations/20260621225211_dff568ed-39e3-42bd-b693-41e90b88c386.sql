-- 1) Adicionar valor 'descredenciado' ao enum lead_etapa (precisa estar em transação separada do uso)
ALTER TYPE public.lead_etapa ADD VALUE IF NOT EXISTS 'descredenciado';

-- 2) Colunas de descredenciamento em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS motivo_descredenciamento text,
  ADD COLUMN IF NOT EXISTS descredenciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS descredenciado_por uuid;
