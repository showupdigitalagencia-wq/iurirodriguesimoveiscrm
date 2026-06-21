
-- 1) Coluna de primeiro contato em vendas_leads (leads já possui first_response_at)
ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

CREATE INDEX IF NOT EXISTS vendas_leads_first_response_idx
  ON public.vendas_leads (first_response_at);
CREATE INDEX IF NOT EXISTS leads_first_response_idx
  ON public.leads (first_response_at);

-- 2) Trigger: registra criação de lead em audit_log
CREATE OR REPLACE FUNCTION public.audit_lead_created_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.log_audit(
    'lead_created',
    TG_TABLE_NAME,
    NEW.id::text,
    NULL,
    jsonb_build_object(
      'nome', NEW.nome,
      'telefone', NEW.telefone,
      'origem', NEW.origem,
      'regiao', NEW.regiao,
      'created_at', NEW.created_at
    ),
    jsonb_build_object('origem_sistema', 'trigger_insert')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_lead_created_vendas ON public.vendas_leads;
CREATE TRIGGER audit_lead_created_vendas
  AFTER INSERT ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_lead_created_trigger();

DROP TRIGGER IF EXISTS audit_lead_created_cap ON public.leads;
CREATE TRIGGER audit_lead_created_cap
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_lead_created_trigger();

-- 3) Trigger: primeiro contato em vendas_leads
--    Dispara quando atribuicao_status passa para 'aceito' OU quando uma
--    primeira mensagem (ultima_mensagem_em) é registrada manualmente.
CREATE OR REPLACE FUNCTION public.audit_vendas_lead_first_response_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _set_now boolean := false;
  _delta_seg numeric;
BEGIN
  IF NEW.first_response_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.atribuicao_status = 'aceito'
     AND COALESCE(OLD.atribuicao_status, '') IS DISTINCT FROM 'aceito' THEN
    _set_now := true;
  END IF;

  IF _set_now THEN
    NEW.first_response_at := now();
    _delta_seg := EXTRACT(EPOCH FROM (NEW.first_response_at - NEW.created_at));
    PERFORM public.log_audit(
      'lead_first_response',
      TG_TABLE_NAME,
      NEW.id::text,
      jsonb_build_object('first_response_at', OLD.first_response_at),
      jsonb_build_object(
        'first_response_at', NEW.first_response_at,
        'tempo_resposta_seg', _delta_seg,
        'corretor_id', NEW.corretor_id
      ),
      jsonb_build_object('gatilho', 'atribuicao_status=aceito')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_vendas_first_response ON public.vendas_leads;
CREATE TRIGGER audit_vendas_first_response
  BEFORE UPDATE ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_vendas_lead_first_response_trigger();

-- 4) Trigger: primeiro contato em leads (captação)
CREATE OR REPLACE FUNCTION public.audit_leads_first_response_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _delta_seg numeric;
BEGIN
  IF OLD.first_response_at IS NULL AND NEW.first_response_at IS NOT NULL THEN
    _delta_seg := EXTRACT(EPOCH FROM (NEW.first_response_at - NEW.created_at));
    PERFORM public.log_audit(
      'lead_first_response',
      TG_TABLE_NAME,
      NEW.id::text,
      jsonb_build_object('first_response_at', OLD.first_response_at),
      jsonb_build_object(
        'first_response_at', NEW.first_response_at,
        'tempo_resposta_seg', _delta_seg,
        'responsavel_id', NEW.responsavel_id
      ),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_leads_first_response ON public.leads;
CREATE TRIGGER audit_leads_first_response
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_leads_first_response_trigger();

-- 5) Função: lista leads sem primeiro contato (admin only)
CREATE OR REPLACE FUNCTION public.get_leads_sem_resposta()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH unidos AS (
    SELECT
      vl.id::text AS id,
      'vendas_leads'::text AS tabela,
      vl.nome,
      vl.telefone,
      vl.origem::text AS origem,
      vl.regiao::text AS regiao,
      vl.created_at,
      vl.corretor_id AS responsavel_id,
      p.nome AS responsavel_nome,
      vl.atribuicao_status,
      EXTRACT(EPOCH FROM (now() - vl.created_at))::bigint AS segundos_decorridos
    FROM public.vendas_leads vl
    LEFT JOIN public.profiles p ON p.id = vl.corretor_id
    WHERE vl.first_response_at IS NULL
      AND vl.etapa <> 'fechado'
      AND vl.etapa <> 'perdido'

    UNION ALL

    SELECT
      l.id::text AS id,
      'leads'::text AS tabela,
      l.nome,
      l.telefone,
      l.origem::text AS origem,
      l.regiao::text AS regiao,
      l.created_at,
      l.responsavel_id,
      r.nome AS responsavel_nome,
      NULL::text AS atribuicao_status,
      EXTRACT(EPOCH FROM (now() - l.created_at))::bigint AS segundos_decorridos
    FROM public.leads l
    LEFT JOIN public.responsaveis r ON r.id = l.responsavel_id
    WHERE l.first_response_at IS NULL
      AND l.etapa <> 'fechado'
      AND l.etapa <> 'perdido'
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'total', COUNT(*),
    'leads', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'tabela', tabela,
      'nome', nome,
      'telefone', telefone,
      'origem', origem,
      'regiao', regiao,
      'created_at', created_at,
      'responsavel_id', responsavel_id,
      'responsavel_nome', responsavel_nome,
      'atribuicao_status', atribuicao_status,
      'segundos_decorridos', segundos_decorridos
    ) ORDER BY segundos_decorridos DESC), '[]'::jsonb)
  ) INTO _result
  FROM unidos;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leads_sem_resposta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leads_sem_resposta() TO authenticated, service_role;
