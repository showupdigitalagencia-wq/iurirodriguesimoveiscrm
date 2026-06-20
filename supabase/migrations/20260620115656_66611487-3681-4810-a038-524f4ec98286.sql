
-- 1) Novo role correspondente_bancaria
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'correspondente_bancaria';

-- 2) Helper que evita usar o novo valor enum na mesma transação (usa ::text)
CREATE OR REPLACE FUNCTION public.is_correspondente_bancaria(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'correspondente_bancaria'
  );
$$;

-- 3) Enum de status
DO $$ BEGIN
  CREATE TYPE public.financiamento_status AS ENUM ('pendente', 'em_analise', 'aprovado', 'recusado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Tabela financiamentos
CREATE TABLE public.financiamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.vendas_leads(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf text NOT NULL,
  telefone text NOT NULL,
  email text,
  estado_civil text,
  renda_mensal numeric,
  profissao text,
  imovel_endereco text,
  imovel_valor numeric,
  rg_path text,
  cpf_path text,
  comp_renda_path text,
  comp_residencia_path text,
  extrato_path text,
  status public.financiamento_status NOT NULL DEFAULT 'pendente',
  observacao text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financiamentos_lead ON public.financiamentos(lead_id);
CREATE INDEX idx_financiamentos_status ON public.financiamentos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiamentos TO authenticated;
GRANT ALL ON public.financiamentos TO service_role;

ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "admin_all_financiamentos"
  ON public.financiamentos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Correspondente bancária: tudo
CREATE POLICY "correspondente_all_financiamentos"
  ON public.financiamentos FOR ALL
  USING (public.is_correspondente_bancaria(auth.uid()))
  WITH CHECK (public.is_correspondente_bancaria(auth.uid()));

-- Corretor: SELECT apenas dos próprios leads
CREATE POLICY "corretor_select_financiamentos"
  ON public.financiamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendas_leads vl
      WHERE vl.id = financiamentos.lead_id
        AND vl.corretor_id = auth.uid()
    )
  );

-- Executivo: SELECT dos leads dos corretores da sua equipe
CREATE POLICY "executivo_select_financiamentos"
  ON public.financiamentos FOR SELECT
  USING (
    public.current_user_is_executivo()
    AND EXISTS (
      SELECT 1
      FROM public.vendas_leads vl
      JOIN public.profiles p ON p.id = vl.corretor_id
      WHERE vl.id = financiamentos.lead_id
        AND p.responsavel_id = public.current_user_executivo_id()
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_financiamentos_updated_at
  BEFORE UPDATE ON public.financiamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Storage policies para bucket financiamento-docs
CREATE POLICY "financiamento_docs_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'financiamento-docs'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_correspondente_bancaria(auth.uid())
    )
  );

CREATE POLICY "financiamento_docs_admin_write"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'financiamento-docs'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_correspondente_bancaria(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'financiamento-docs'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_correspondente_bancaria(auth.uid())
    )
  );
