
CREATE OR REPLACE FUNCTION public.calc_lead_score_vendas(_lead vendas_leads)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _cfg jsonb;
  _score int := 0;
  _dias_inativo int;
  _ultima timestamptz;
BEGIN
  SELECT valor INTO _cfg FROM public.configuracoes WHERE chave = 'lead_score_config_vendas';
  _cfg := COALESCE(_cfg, '{}'::jsonb);

  -- Base score por etapa
  _score := CASE _lead.etapa
    WHEN 'novo_lead'         THEN COALESCE((_cfg#>>'{etapas,novo_lead}')::int, 20)
    WHEN 'contato_realizado' THEN COALESCE((_cfg#>>'{etapas,contato_realizado}')::int, 45)
    WHEN 'visita_agendada'   THEN COALESCE((_cfg#>>'{etapas,visita_agendada}')::int, 75)
    WHEN 'proposta_enviada'  THEN COALESCE((_cfg#>>'{etapas,proposta_enviada}')::int, 80)
    WHEN 'em_negociacao'     THEN COALESCE((_cfg#>>'{etapas,em_negociacao}')::int, 85)
    WHEN 'follow_up'         THEN COALESCE((_cfg#>>'{etapas,follow_up}')::int, 50)
    WHEN 'fechado'           THEN 100
    WHEN 'perdido'           THEN 10
    ELSE 20
  END;

  -- Penalidade por inatividade (não aplica a fechado/perdido)
  IF _lead.etapa NOT IN ('fechado'::public.vendas_etapa, 'perdido'::public.vendas_etapa) THEN
    _ultima := GREATEST(COALESCE(_lead.ultima_mensagem_em, _lead.updated_at), _lead.updated_at);
    _dias_inativo := EXTRACT(DAY FROM (now() - _ultima))::int;
    IF _dias_inativo > 21 THEN
      _score := _score + COALESCE((_cfg#>>'{pesos,inativo_21d}')::int, -30);
    ELSIF _dias_inativo > 14 THEN
      _score := _score + COALESCE((_cfg#>>'{pesos,inativo_14d}')::int, -20);
    END IF;
  END IF;

  RETURN LEAST(100, GREATEST(0, _score));
END $function$;

-- Atualiza config para refletir nova regra
UPDATE public.configuracoes
SET valor = jsonb_build_object(
  'etapas', jsonb_build_object(
    'novo_lead', 20,
    'contato_realizado', 45,
    'visita_agendada', 75,
    'proposta_enviada', 80,
    'em_negociacao', 85,
    'follow_up', 50,
    'fechado', 100,
    'perdido', 10
  ),
  'pesos', jsonb_build_object(
    'inativo_14d', -20,
    'inativo_21d', -30
  ),
  'limiares', jsonb_build_object(
    'frio_max', 39,
    'morno_max', 69
  )
)
WHERE chave = 'lead_score_config_vendas';

-- Backfill
UPDATE public.vendas_leads SET updated_at = updated_at;
