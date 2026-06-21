
-- ============ 1. Enum + colunas em vendas_leads ============
DO $$ BEGIN
  CREATE TYPE public.lead_origem AS ENUM (
    'zap_imoveis','olx','site','whatsapp_empresa','facebook','manual','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS origem public.lead_origem NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origem_detalhe text,
  ADD COLUMN IF NOT EXISTS ultima_mensagem_em timestamptz,
  ADD COLUMN IF NOT EXISTS plantao_dia date;

CREATE INDEX IF NOT EXISTS idx_vendas_leads_telefone ON public.vendas_leads (telefone);
CREATE INDEX IF NOT EXISTS idx_vendas_leads_plantao_dia ON public.vendas_leads (plantao_dia);

-- ============ 2. Tabela plantao_escala ============
CREATE TABLE IF NOT EXISTS public.plantao_escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  corretor_id uuid NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantao_escala TO authenticated;
GRANT ALL ON public.plantao_escala TO service_role;

ALTER TABLE public.plantao_escala ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escala visivel para usuarios ativos"
  ON public.plantao_escala FOR SELECT
  TO authenticated
  USING (public.current_user_is_active());

CREATE POLICY "Admins e executivos gerenciam escala"
  ON public.plantao_escala FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.current_user_is_executivo())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.current_user_is_executivo());

CREATE TRIGGER plantao_escala_updated
  BEFORE UPDATE ON public.plantao_escala
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. Tabela plantao_log ============
DO $$ BEGIN
  CREATE TYPE public.plantao_motivo AS ENUM (
    'novo_lead','reincidencia','redirecionamento_demora','sem_plantonista'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.plantao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  corretor_id uuid,
  motivo public.plantao_motivo NOT NULL,
  origem public.lead_origem,
  detalhe jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.plantao_log TO authenticated;
GRANT ALL ON public.plantao_log TO service_role;

ALTER TABLE public.plantao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e exec leem log"
  ON public.plantao_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.current_user_is_executivo());

CREATE POLICY "Service insere log"
  ON public.plantao_log FOR INSERT
  TO authenticated
  WITH CHECK (false); -- inserts so via service_role no servidor

CREATE INDEX IF NOT EXISTS idx_plantao_log_lead ON public.plantao_log (lead_id);
CREATE INDEX IF NOT EXISTS idx_plantao_log_corretor ON public.plantao_log (corretor_id, criado_em DESC);

-- ============ 4. Funções utilitárias ============
CREATE OR REPLACE FUNCTION public.plantonista_do_dia(_data date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT corretor_id FROM public.plantao_escala WHERE data = _data LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_corretor_vendas_ou_executivo(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('corretor_vendas','corretor'))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.responsaveis r ON r.id = p.responsavel_id AND r.ativo = true
        AND lower(split_part(trim(r.nome),' ',1)) = lower(split_part(trim(p.nome),' ',1))
      WHERE p.id = _uid AND COALESCE(p.ativo,true) = true
    );
$$;
