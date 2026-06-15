
-- 1. Add new role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corretor_vendas';

-- 2. Vendas pipeline enum
DO $$ BEGIN
  CREATE TYPE public.vendas_etapa AS ENUM (
    'novo_lead','contato_realizado','visita_agendada','proposta_enviada',
    'em_negociacao','follow_up','fechado','perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vendas_tipo AS ENUM ('compra','locacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. vendas_leads table
CREATE TABLE IF NOT EXISTS public.vendas_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  tipo public.vendas_tipo NOT NULL DEFAULT 'compra',
  regiao public.lead_regiao NOT NULL DEFAULT 'barra_da_tijuca',
  valor NUMERIC(14,2),
  observacoes TEXT,
  etapa public.vendas_etapa NOT NULL DEFAULT 'novo_lead',
  corretor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executivo_canal public.lead_canal,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_leads TO authenticated;
GRANT ALL ON public.vendas_leads TO service_role;

ALTER TABLE public.vendas_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam vendas_leads" ON public.vendas_leads;
CREATE POLICY "Admins gerenciam vendas_leads" ON public.vendas_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Corretor vê seus leads" ON public.vendas_leads;
CREATE POLICY "Corretor vê seus leads" ON public.vendas_leads
  FOR SELECT TO authenticated
  USING (corretor_id = auth.uid());

DROP POLICY IF EXISTS "Corretor edita seus leads" ON public.vendas_leads;
CREATE POLICY "Corretor edita seus leads" ON public.vendas_leads
  FOR UPDATE TO authenticated
  USING (corretor_id = auth.uid())
  WITH CHECK (corretor_id = auth.uid());

DROP POLICY IF EXISTS "Corretor cria leads próprios" ON public.vendas_leads;
CREATE POLICY "Corretor cria leads próprios" ON public.vendas_leads
  FOR INSERT TO authenticated
  WITH CHECK (corretor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vendas_leads_updated_at
  BEFORE UPDATE ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vendas_leads_corretor ON public.vendas_leads(corretor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_leads_etapa ON public.vendas_leads(etapa);

-- 4. Toggle config (desligado por padrão)
INSERT INTO public.configuracoes (chave, valor)
VALUES ('sistema_corretores_ativo', 'false'::jsonb)
ON CONFLICT (chave) DO NOTHING;
