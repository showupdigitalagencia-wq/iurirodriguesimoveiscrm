
-- 1) Triggers que setam first_response_at na primeira mudança de etapa saindo de "Novo"

CREATE OR REPLACE FUNCTION public.vendas_lead_first_contact_by_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.first_response_at IS NULL
     AND OLD.etapa = 'novo_lead'::public.vendas_etapa
     AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_lead_first_contact_by_etapa ON public.vendas_leads;
CREATE TRIGGER trg_vendas_lead_first_contact_by_etapa
BEFORE UPDATE OF etapa ON public.vendas_leads
FOR EACH ROW EXECUTE FUNCTION public.vendas_lead_first_contact_by_etapa();

CREATE OR REPLACE FUNCTION public.lead_first_contact_by_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.first_response_at IS NULL
     AND OLD.etapa = 'novos_leads'::public.lead_etapa
     AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_first_contact_by_etapa ON public.leads;
CREATE TRIGGER trg_lead_first_contact_by_etapa
BEFORE UPDATE OF etapa ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.lead_first_contact_by_etapa();

-- 2) RPC ranking de tempo de resposta
CREATE OR REPLACE FUNCTION public.get_tempo_resposta_ranking(
  _from timestamptz,
  _to timestamptz,
  _scope text DEFAULT 'auto',
  _target uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_exec boolean;
  _exec_id uuid;
  _effective_scope text;
  _allowed uuid[];
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _is_admin := public.has_role(_uid, 'admin'::public.app_role);
  _is_exec := public.current_user_is_executivo();
  _exec_id := public.current_user_executivo_id();

  _effective_scope := COALESCE(_scope, 'auto');
  IF _effective_scope = 'auto' THEN
    IF _is_admin THEN _effective_scope := 'all';
    ELSIF _is_exec THEN _effective_scope := 'team';
    ELSE _effective_scope := 'me';
    END IF;
  END IF;

  IF _effective_scope = 'me' THEN
    _allowed := ARRAY[_uid];
  ELSIF _effective_scope = 'team' THEN
    IF _is_admin AND _target IS NOT NULL THEN
      SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _target AND ativo = true;
    ELSIF _is_exec AND _exec_id IS NOT NULL THEN
      SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _exec_id AND ativo = true;
      _allowed := COALESCE(_allowed, ARRAY[]::uuid[]) || _uid;
    ELSE RAISE EXCEPTION 'forbidden';
    END IF;
  ELSIF _effective_scope = 'all' THEN
    IF NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  ELSE
    RAISE EXCEPTION 'invalid scope';
  END IF;

  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  WITH base AS (
    SELECT vl.id, vl.corretor_id, vl.nome, vl.telefone, vl.created_at, vl.first_response_at, vl.etapa
    FROM public.vendas_leads vl
    WHERE vl.corretor_id = ANY(_allowed)
      AND vl.created_at >= _from AND vl.created_at <= _to
  ),
  com_resposta AS (
    SELECT corretor_id, EXTRACT(EPOCH FROM (first_response_at - created_at)) AS seg
    FROM base
    WHERE first_response_at IS NOT NULL
  ),
  ranking AS (
    SELECT
      p.id AS corretor_id,
      p.nome,
      r.nome AS equipe_nome,
      COUNT(b.id) AS total_leads,
      COUNT(b.first_response_at) AS respondidos,
      COUNT(b.id) FILTER (WHERE b.first_response_at IS NULL AND b.etapa NOT IN ('fechado','perdido')) AS pendentes,
      AVG(EXTRACT(EPOCH FROM (b.first_response_at - b.created_at))) FILTER (WHERE b.first_response_at IS NOT NULL) AS tempo_medio_seg,
      MIN(EXTRACT(EPOCH FROM (b.first_response_at - b.created_at))) FILTER (WHERE b.first_response_at IS NOT NULL) AS tempo_min_seg,
      MAX(EXTRACT(EPOCH FROM (b.first_response_at - b.created_at))) FILTER (WHERE b.first_response_at IS NOT NULL) AS tempo_max_seg
    FROM profiles p
    LEFT JOIN responsaveis r ON r.id = p.responsavel_id
    LEFT JOIN base b ON b.corretor_id = p.id
    WHERE p.id = ANY(_allowed)
    GROUP BY p.id, p.nome, r.nome
  ),
  aguardando AS (
    SELECT b.id, b.nome, b.telefone, b.created_at, b.corretor_id,
      p.nome AS corretor_nome,
      EXTRACT(EPOCH FROM (now() - b.created_at))::bigint AS segundos_aguardando
    FROM base b
    LEFT JOIN profiles p ON p.id = b.corretor_id
    WHERE b.first_response_at IS NULL
      AND b.etapa NOT IN ('fechado','perdido')
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to),
    'escopo', jsonb_build_object('is_admin', _is_admin, 'is_exec', _is_exec, 'scope', _effective_scope, 'usuarios', COALESCE(array_length(_allowed,1), 0)),
    'media_geral_seg', (SELECT AVG(seg) FROM com_resposta),
    'total_respondidos', (SELECT COUNT(*) FROM com_resposta),
    'ranking', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'corretor_id', corretor_id,
        'nome', nome,
        'equipe', equipe_nome,
        'total_leads', total_leads,
        'respondidos', respondidos,
        'pendentes', pendentes,
        'tempo_medio_seg', tempo_medio_seg,
        'tempo_min_seg', tempo_min_seg,
        'tempo_max_seg', tempo_max_seg
      ) ORDER BY tempo_medio_seg NULLS LAST), '[]'::jsonb) FROM ranking),
    'aguardando', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'telefone', telefone,
        'created_at', created_at,
        'corretor_id', corretor_id, 'corretor_nome', corretor_nome,
        'segundos_aguardando', segundos_aguardando
      ) ORDER BY segundos_aguardando DESC), '[]'::jsonb) FROM aguardando)
  ) INTO _result;

  RETURN _result;
END;
$$;
