
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'corretor');
CREATE TYPE public.lead_etapa AS ENUM (
  'novos_leads',
  'em_atendimento',
  'visita_agendada',
  'proposta_enviada',
  'em_negociacao',
  'fechado_ganho',
  'fechado_perdido'
);
CREATE TYPE public.lead_canal AS ENUM ('denise', 'fabiola', 'renata', 'robson');
CREATE TYPE public.lead_regiao AS ENUM (
  'barra_da_tijuca',
  'recreio',
  'jacarepagua',
  'zona_sul',
  'zona_norte',
  'zona_oeste',
  'centro',
  'outras'
);

-- ============ updated_at TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ RESPONSAVEIS ============
CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  canal public.lead_canal NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT SELECT ON public.responsaveis TO anon;
GRANT ALL ON public.responsaveis TO service_role;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_responsaveis" ON public.responsaveis
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authenticated_manage_responsaveis" ON public.responsaveis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_responsaveis_updated_at BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.responsaveis (nome, canal, whatsapp) VALUES
  ('Denise', 'denise', '5521900000001'),
  ('Fabiola', 'fabiola', '5521900000002'),
  ('Renata', 'renata', '5521900000003'),
  ('Robson', 'robson', '5521900000004');

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  is_corretor BOOLEAN NOT NULL DEFAULT false,
  creci TEXT,
  regiao public.lead_regiao NOT NULL,
  tipo_imovel TEXT,
  faixa_valor TEXT,
  observacoes TEXT,
  etapa public.lead_etapa NOT NULL DEFAULT 'novos_leads',
  canal public.lead_canal NOT NULL,
  responsavel_id UUID REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  first_response_at TIMESTAMPTZ,
  fechado_em TIMESTAMPTZ,
  motivo_perda TEXT,
  origem TEXT DEFAULT 'formulario_site',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_etapa ON public.leads(etapa);
CREATE INDEX idx_leads_canal ON public.leads(canal);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_responsavel ON public.leads(responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_insert_leads" ON public.leads
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_read_leads" ON public.leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_leads" ON public.leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_leads" ON public.leads
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- ============ LEAD_HISTORICO ============
CREATE TABLE public.lead_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhe JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historico_lead ON public.lead_historico(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.lead_historico TO authenticated;
GRANT INSERT ON public.lead_historico TO anon;
GRANT ALL ON public.lead_historico TO service_role;
ALTER TABLE public.lead_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_historico" ON public.lead_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_historico" ON public.lead_historico
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anon_insert_historico" ON public.lead_historico
  FOR INSERT TO anon WITH CHECK (true);

-- ============ NOTIFICACOES ============
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  destino TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  payload JSONB,
  resposta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_lead ON public.notificacoes(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_notif" ON public.notificacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_notif" ON public.notificacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CONFIGURACOES ============
CREATE TABLE public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_config" ON public.configuracoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.configuracoes (chave, valor) VALUES
  ('horario_atendimento', '{"inicio": "08:00", "fim": "20:00", "dias": [1,2,3,4,5,6]}'::jsonb),
  ('sla_primeira_resposta_min', '30'::jsonb),
  ('sla_alerta_min', '60'::jsonb),
  ('mapeamento_regiao_canal', '{
    "barra_da_tijuca": "denise",
    "recreio": "fabiola",
    "jacarepagua": "renata",
    "zona_sul": "denise",
    "zona_norte": "robson",
    "zona_oeste": "fabiola",
    "centro": "robson",
    "outras": "denise"
  }'::jsonb);

-- ============ AUTO-ASSIGN ROLE ON FIRST USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'corretor');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
