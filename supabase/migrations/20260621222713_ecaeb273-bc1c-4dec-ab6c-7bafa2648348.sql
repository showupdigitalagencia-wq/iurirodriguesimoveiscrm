
-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_nome text,
  acao text NOT NULL,
  tabela text,
  registro_id text,
  antes jsonb,
  depois jsonb,
  contexto jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_criado_idx ON public.audit_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_log_acao_idx ON public.audit_log (acao, criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_log_tabela_idx ON public.audit_log (tabela, criado_em DESC);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Somente admin lê. Ninguém insere/atualiza/deleta via Data API (apenas SECURITY DEFINER funcs e service_role).
CREATE POLICY "audit_log_admin_select"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Função de gravação (chamada por server fns e triggers)
CREATE OR REPLACE FUNCTION public.log_audit(
  _acao text,
  _tabela text DEFAULT NULL,
  _registro_id text DEFAULT NULL,
  _antes jsonb DEFAULT NULL,
  _depois jsonb DEFAULT NULL,
  _contexto jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nome text;
  _id uuid;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT nome INTO _nome FROM public.profiles WHERE id = _uid;
  END IF;

  INSERT INTO public.audit_log (user_id, user_nome, acao, tabela, registro_id, antes, depois, contexto)
  VALUES (_uid, _nome, _acao, _tabela, _registro_id, _antes, _depois, _contexto)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- 3) Trigger genérico de DELETE para tabelas sensíveis
CREATE OR REPLACE FUNCTION public.audit_delete_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.log_audit(
    'delete',
    TG_TABLE_NAME,
    COALESCE((to_jsonb(OLD)->>'id'), NULL),
    to_jsonb(OLD),
    NULL,
    jsonb_build_object('trigger', TG_NAME, 'schema', TG_TABLE_SCHEMA)
  );
  RETURN OLD;
END;
$$;

-- 4) Trigger de mudança de papel
CREATE OR REPLACE FUNCTION public.audit_user_roles_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit('role_grant', 'user_roles',
      NEW.user_id::text, NULL, to_jsonb(NEW),
      jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit('role_revoke', 'user_roles',
      OLD.user_id::text, to_jsonb(OLD), NULL,
      jsonb_build_object('role', OLD.role));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit('role_change', 'user_roles',
      NEW.user_id::text, to_jsonb(OLD), to_jsonb(NEW), NULL);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_trigger();

-- 5) Triggers de DELETE em tabelas sensíveis
DROP TRIGGER IF EXISTS audit_delete_leads ON public.leads;
CREATE TRIGGER audit_delete_leads
  AFTER DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

DROP TRIGGER IF EXISTS audit_delete_vendas_leads ON public.vendas_leads;
CREATE TRIGGER audit_delete_vendas_leads
  AFTER DELETE ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

DROP TRIGGER IF EXISTS audit_delete_financiamentos ON public.financiamentos;
CREATE TRIGGER audit_delete_financiamentos
  AFTER DELETE ON public.financiamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

DROP TRIGGER IF EXISTS audit_delete_imoveis ON public.imoveis;
CREATE TRIGGER audit_delete_imoveis
  AFTER DELETE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

DROP TRIGGER IF EXISTS audit_delete_contratos ON public.contratos;
CREATE TRIGGER audit_delete_contratos
  AFTER DELETE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

DROP TRIGGER IF EXISTS audit_delete_candidatos ON public.candidatos;
CREATE TRIGGER audit_delete_candidatos
  AFTER DELETE ON public.candidatos
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();
