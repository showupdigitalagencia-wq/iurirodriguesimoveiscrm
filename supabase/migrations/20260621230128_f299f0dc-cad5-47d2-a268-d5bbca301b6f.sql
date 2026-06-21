
-- Phase 1: Funil de Conversão Visual

-- 1) Histórico de mudança de etapa para vendas_leads (espelho de lead_historico)
CREATE TABLE IF NOT EXISTS public.vendas_lead_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.vendas_leads(id) ON DELETE CASCADE,
  user_id uuid,
  etapa_anterior public.vendas_etapa,
  etapa_nova public.vendas_etapa NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.vendas_lead_historico TO authenticated;
GRANT ALL ON public.vendas_lead_historico TO service_role;

ALTER TABLE public.vendas_lead_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_hist_select_admin_exec_owner" ON public.vendas_lead_historico
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.current_user_is_executivo()
  OR EXISTS (SELECT 1 FROM public.vendas_leads vl WHERE vl.id = vendas_lead_historico.lead_id AND vl.corretor_id = auth.uid())
);

CREATE POLICY "vendas_hist_insert_system" ON public.vendas_lead_historico
FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vendas_lead_historico_lead ON public.vendas_lead_historico(lead_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_vendas_lead_historico_etapa_data ON public.vendas_lead_historico(etapa_nova, criado_em);

-- Trigger
CREATE OR REPLACE FUNCTION public.vendas_lead_etapa_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vendas_lead_historico (lead_id, user_id, etapa_anterior, etapa_nova)
    VALUES (NEW.id, auth.uid(), NULL, NEW.etapa);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    INSERT INTO public.vendas_lead_historico (lead_id, user_id, etapa_anterior, etapa_nova)
    VALUES (NEW.id, auth.uid(), OLD.etapa, NEW.etapa);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_lead_etapa_log ON public.vendas_leads;
CREATE TRIGGER trg_vendas_lead_etapa_log
AFTER INSERT OR UPDATE OF etapa ON public.vendas_leads
FOR EACH ROW EXECUTE FUNCTION public.vendas_lead_etapa_log();

-- Backfill: cada vendas_lead ganha entrada inicial com a etapa atual (created_at)
INSERT INTO public.vendas_lead_historico (lead_id, user_id, etapa_anterior, etapa_nova, criado_em)
SELECT vl.id, vl.corretor_id, NULL, vl.etapa, vl.created_at
FROM public.vendas_leads vl
LEFT JOIN public.vendas_lead_historico h ON h.lead_id = vl.id
WHERE h.id IS NULL;

-- 2) Função get_funil_conversao
CREATE OR REPLACE FUNCTION public.get_funil_conversao(
  _pipeline text,
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
  _etapas text[];
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
  ELSIF _effective_scope = 'user' THEN
    IF _target IS NULL THEN RAISE EXCEPTION 'target required'; END IF;
    IF _is_admin THEN _allowed := ARRAY[_target];
    ELSIF _is_exec AND (_target = _uid OR EXISTS (SELECT 1 FROM profiles WHERE id = _target AND responsavel_id = _exec_id)) THEN
      _allowed := ARRAY[_target];
    ELSIF _target = _uid THEN _allowed := ARRAY[_uid];
    ELSE RAISE EXCEPTION 'forbidden';
    END IF;
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

  IF _pipeline = 'captacao' THEN
    _etapas := ARRAY['novos_leads','em_atendimento','reuniao_agendada','solicitacao_documentos','documentos_enviados','fechado','descartado','descredenciado'];

    WITH atuais AS (
      SELECT l.etapa::text AS etapa, COUNT(*) AS qtd
      FROM public.leads l
      WHERE l.created_at >= _from AND l.created_at <= _to
        AND (
          _is_admin
          OR (l.responsavel_id IS NOT NULL AND l.responsavel_id = _exec_id)
          OR FALSE
        )
      GROUP BY l.etapa
    ),
    passaram AS (
      SELECT lh.etapa::text AS etapa, COUNT(DISTINCT lh.lead_id) AS qtd
      FROM public.lead_historico lh
      JOIN public.leads l ON l.id = lh.lead_id
      WHERE lh.criado_em >= _from AND lh.criado_em <= _to
        AND lh.acao = 'mudanca_etapa'
        AND (_is_admin OR (l.responsavel_id IS NOT NULL AND l.responsavel_id = _exec_id))
      GROUP BY lh.etapa
    )
    SELECT jsonb_build_object(
      'pipeline', 'captacao',
      'etapas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', e,
          'atual', COALESCE((SELECT qtd FROM atuais WHERE etapa = e), 0),
          'passaram', COALESCE((SELECT qtd FROM passaram WHERE etapa = e), 0)
        ) ORDER BY array_position(_etapas, e)), '[]'::jsonb)
        FROM unnest(_etapas) AS e
      )
    ) INTO _result;

  ELSIF _pipeline = 'vendas' THEN
    _etapas := ARRAY['novo_lead','contato_realizado','visita_agendada','proposta_enviada','em_negociacao','follow_up','fechado','perdido'];

    WITH atuais AS (
      SELECT vl.etapa::text AS etapa, COUNT(*) AS qtd
      FROM public.vendas_leads vl
      WHERE vl.created_at >= _from AND vl.created_at <= _to
        AND vl.corretor_id = ANY(_allowed)
      GROUP BY vl.etapa
    ),
    passaram AS (
      SELECT h.etapa_nova::text AS etapa, COUNT(DISTINCT h.lead_id) AS qtd
      FROM public.vendas_lead_historico h
      JOIN public.vendas_leads vl ON vl.id = h.lead_id
      WHERE h.criado_em >= _from AND h.criado_em <= _to
        AND vl.corretor_id = ANY(_allowed)
      GROUP BY h.etapa_nova
    )
    SELECT jsonb_build_object(
      'pipeline', 'vendas',
      'etapas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', e,
          'atual', COALESCE((SELECT qtd FROM atuais WHERE etapa = e), 0),
          'passaram', COALESCE((SELECT qtd FROM passaram WHERE etapa = e), 0)
        ) ORDER BY array_position(_etapas, e)), '[]'::jsonb)
        FROM unnest(_etapas) AS e
      )
    ) INTO _result;

  ELSE
    RAISE EXCEPTION 'invalid pipeline';
  END IF;

  RETURN _result || jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to),
    'escopo', jsonb_build_object('is_admin', _is_admin, 'is_exec', _is_exec, 'scope', _effective_scope, 'usuarios', COALESCE(array_length(_allowed,1), 0))
  );
END;
$$;
