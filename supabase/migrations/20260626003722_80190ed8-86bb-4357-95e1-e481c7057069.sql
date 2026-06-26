
-- ===== Colunas de score nas duas pipelines =====
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_temperatura int,
  ADD COLUMN IF NOT EXISTS temperatura text;

ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS score_temperatura int,
  ADD COLUMN IF NOT EXISTS temperatura text;

-- ===== Helper de faixa =====
CREATE OR REPLACE FUNCTION public.temperatura_from_score(_score int, _frio_max int DEFAULT 39, _morno_max int DEFAULT 69)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _score IS NULL THEN NULL
    WHEN _score <= _frio_max THEN 'frio'
    WHEN _score <= _morno_max THEN 'morno'
    ELSE 'quente'
  END;
$$;

-- ===== Configurações (pesos e faixas editáveis) =====
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('lead_score_config_captacao', jsonb_build_object(
    'pesos', jsonb_build_object(
      'ja_corretor_credenciado', 30,
      'ja_corretor_em_cred', 15,
      'ja_corretor_interesse', 5,
      'creci_ativo', 25,
      'disponibilidade_regiao', 20,
      'disponibilidade_video', 15,
      'possui_veiculo', 10
    ),
    'faixas', jsonb_build_object('frio_max', 39, 'morno_max', 69)
  )),
  ('lead_score_config_vendas', jsonb_build_object(
    'pesos', jsonb_build_object(
      'imovel_vinculado', 25,
      'tipo_definido', 15,
      'respondido', 15,
      'visita_agendada', 20,
      'visita_realizada', 25,
      'inativo_14d', -20,
      'inativo_21d', -30
    ),
    'faixas', jsonb_build_object('frio_max', 39, 'morno_max', 69)
  ))
ON CONFLICT (chave) DO NOTHING;

-- ===== Cálculo Captação =====
CREATE OR REPLACE FUNCTION public.calc_lead_score_captacao(_lead public.leads)
RETURNS int LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _cfg jsonb;
  _d jsonb := COALESCE(_lead.dados_corretor, '{}'::jsonb);
  _score int := 0;
  _v text;
BEGIN
  SELECT valor INTO _cfg FROM public.configuracoes WHERE chave = 'lead_score_config_captacao';
  _cfg := COALESCE(_cfg, '{}'::jsonb);

  _v := lower(coalesce(_d->>'ja_corretor', _d->>'já_corretor', ''));
  IF _v LIKE '%em credenciamento%' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,ja_corretor_em_cred}')::int, 15);
  ELSIF _v LIKE '%credenciad%' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,ja_corretor_credenciado}')::int, 30);
  ELSIF _v LIKE '%interesse%' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,ja_corretor_interesse}')::int, 5);
  END IF;

  IF lower(coalesce(_d->>'creci_ativo','')) = 'sim' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,creci_ativo}')::int, 25);
  END IF;

  _v := lower(coalesce(_d->>'disponibilidade_regiao', _d->>'disponibilidade_região', ''));
  IF _v IN ('não','nao') THEN
    RETURN 0;
  ELSIF _v = 'sim' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,disponibilidade_regiao}')::int, 20);
  END IF;

  IF lower(coalesce(_d->>'disponibilidade_video','')) = 'sim' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,disponibilidade_video}')::int, 15);
  END IF;

  IF lower(coalesce(_d->>'possui_veiculo','')) = 'sim' THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,possui_veiculo}')::int, 10);
  END IF;

  RETURN LEAST(100, GREATEST(0, _score));
END $$;

-- ===== Cálculo Vendas (comportamental) =====
CREATE OR REPLACE FUNCTION public.calc_lead_score_vendas(_lead public.vendas_leads)
RETURNS int LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _cfg jsonb;
  _score int := 0;
  _has_agendada boolean;
  _has_realizada boolean;
  _dias_inativo int;
  _ultima timestamptz;
BEGIN
  SELECT valor INTO _cfg FROM public.configuracoes WHERE chave = 'lead_score_config_vendas';
  _cfg := COALESCE(_cfg, '{}'::jsonb);

  IF _lead.imovel_id IS NOT NULL THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,imovel_vinculado}')::int, 25);
  END IF;

  IF _lead.tipo IS NOT NULL THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,tipo_definido}')::int, 15);
  END IF;

  IF _lead.first_response_at IS NOT NULL THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,respondido}')::int, 15);
  END IF;

  SELECT
    bool_or(comparecimento::text = 'realizada'),
    bool_or(COALESCE(comparecimento::text,'') <> 'realizada'
            AND COALESCE(status::text,'agendada') <> 'cancelada')
  INTO _has_realizada, _has_agendada
  FROM public.vendas_visitas WHERE lead_id = _lead.id;

  IF COALESCE(_has_realizada, false) THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,visita_realizada}')::int, 25);
  ELSIF COALESCE(_has_agendada, false) THEN
    _score := _score + COALESCE((_cfg#>>'{pesos,visita_agendada}')::int, 20);
  END IF;

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
END $$;

-- ===== Triggers BEFORE para gravar score na linha =====
CREATE OR REPLACE FUNCTION public.trg_leads_set_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.score_temperatura := public.calc_lead_score_captacao(NEW);
  NEW.temperatura := public.temperatura_from_score(NEW.score_temperatura);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_set_score ON public.leads;
CREATE TRIGGER trg_leads_set_score
  BEFORE INSERT OR UPDATE OF dados_corretor ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_set_score();

CREATE OR REPLACE FUNCTION public.trg_vendas_leads_set_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.score_temperatura := public.calc_lead_score_vendas(NEW);
  NEW.temperatura := public.temperatura_from_score(NEW.score_temperatura);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendas_leads_set_score ON public.vendas_leads;
CREATE TRIGGER trg_vendas_leads_set_score
  BEFORE INSERT OR UPDATE OF imovel_id, tipo, first_response_at, ultima_mensagem_em, etapa, updated_at
  ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_leads_set_score();

-- ===== AFTER trigger em visitas: recalcula score do lead vinculado =====
CREATE OR REPLACE FUNCTION public.trg_visitas_recalc_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _lid uuid := COALESCE(NEW.lead_id, OLD.lead_id);
  _vl public.vendas_leads%ROWTYPE;
  _s int;
BEGIN
  IF _lid IS NOT NULL THEN
    SELECT * INTO _vl FROM public.vendas_leads WHERE id = _lid;
    IF FOUND THEN
      _s := public.calc_lead_score_vendas(_vl);
      UPDATE public.vendas_leads
        SET score_temperatura = _s,
            temperatura = public.temperatura_from_score(_s)
        WHERE id = _lid;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_visitas_recalc_score ON public.vendas_visitas;
CREATE TRIGGER trg_visitas_recalc_score
  AFTER INSERT OR UPDATE OR DELETE ON public.vendas_visitas
  FOR EACH ROW EXECUTE FUNCTION public.trg_visitas_recalc_score();

-- ===== Backfill =====
UPDATE public.leads SET dados_corretor = dados_corretor;
UPDATE public.vendas_leads SET updated_at = updated_at;
