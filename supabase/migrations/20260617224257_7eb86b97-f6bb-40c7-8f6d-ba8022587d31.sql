
-- 1. Novo papel administrativo
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrativo';

-- 2. Função auxiliar (evita uso do literal do enum recém-criado na mesma transação)
CREATE OR REPLACE FUNCTION public.is_administrativo(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'administrativo'
  );
$$;

-- 3. Tabela imoveis
CREATE TABLE public.imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('apartamento','casa','comercial')),
  rua text NOT NULL,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  cep text,
  proprietario_nome text NOT NULL,
  proprietario_documento text,
  proprietario_telefone text,
  proprietario_email text,
  valor_aluguel numeric(12,2) NOT NULL DEFAULT 0,
  iptu numeric(12,2) DEFAULT 0,
  condominio numeric(12,2) DEFAULT 0,
  area_m2 numeric(10,2),
  quartos int DEFAULT 0,
  banheiros int DEFAULT 0,
  vagas int DEFAULT 0,
  garantia text CHECK (garantia IN ('fiador','caucao','seguro')),
  fotos text[] DEFAULT ARRAY[]::text[],
  observacoes text,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','locado','manutencao','rescindido')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT ALL ON public.imoveis TO service_role;

ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Administrativo veem imoveis"
  ON public.imoveis FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo inserem imoveis"
  ON public.imoveis FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo atualizam imoveis"
  ON public.imoveis FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo excluem imoveis"
  ON public.imoveis FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE TRIGGER trg_imoveis_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela contratos
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  locatario_nome text NOT NULL,
  locatario_cpf text,
  locatario_rg text,
  locatario_telefone text,
  locatario_email text,
  endereco_anterior text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  duracao_meses int NOT NULL DEFAULT 12,
  valor_aluguel numeric(12,2) NOT NULL DEFAULT 0,
  indice_reajuste text CHECK (indice_reajuste IN ('igpm','ipca','inpc')),
  dia_vencimento int CHECK (dia_vencimento BETWEEN 1 AND 31),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','vencendo','encerrado','rescindido')),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratos_imovel ON public.contratos(imovel_id);
CREATE INDEX idx_contratos_data_fim ON public.contratos(data_fim);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Administrativo veem contratos"
  ON public.contratos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo inserem contratos"
  ON public.contratos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo atualizam contratos"
  ON public.contratos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE POLICY "Admin/Administrativo excluem contratos"
  ON public.contratos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_administrativo(auth.uid()));

CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
