
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperatura_anterior text,
  ADD COLUMN IF NOT EXISTS temperatura_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.leads_bump_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('nexus.skip_updated_at', true) = 'on' THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_bump_updated_at();

CREATE OR REPLACE FUNCTION public.calc_corretor_perf_score(_profile_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  _score int := 50;
  _real_v int := 0;
  _real_l int := 0;
  _meta_v int := 0;
  _meta_l int := 0;
  _avg_resp numeric;
  _ultima timestamptz;
  _dias int;
  _ano int := EXTRACT(YEAR FROM now())::int;
  _mes int := EXTRACT(MONTH FROM now())::int;
BEGIN
  IF _profile_id IS NULL THEN RETURN 50; END IF;

  SELECT
    COUNT(*) FILTER (WHERE tipo = 'compra'),
    COUNT(*) FILTER (WHERE tipo = 'locacao')
  INTO _real_v, _real_l
  FROM public.vendas_leads
  WHERE corretor_id = _profile_id
    AND etapa = 'fechado'::public.vendas_etapa
    AND fechado_em IS NOT NULL
    AND EXTRACT(YEAR FROM fechado_em) = _ano
    AND EXTRACT(MONTH FROM fechado_em) = _mes;

  _score := _score + LEAST(40, COALESCE(_real_v,0) * 15 + COALESCE(_real_l,0) * 10);

  SELECT meta_vendas, meta_locacoes INTO _meta_v, _meta_l
  FROM public.metas_mensais
  WHERE corretor_id = _profile_id AND ano = _ano AND mes = _mes;

  IF (COALESCE(_meta_v,0) > 0 AND COALESCE(_real_v,0) >= _meta_v)
     OR (COALESCE(_meta_l,0) > 0 AND COALESCE(_real_l,0) >= _meta_l) THEN
    _score := _score + 20;
  END IF;

  SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)))
    INTO _avg_resp
  FROM public.vendas_leads
  WHERE corretor_id = _profile_id
    AND first_response_at IS NOT NULL
    AND created_at >= now() - interval '30 days';

  IF _avg_resp IS NOT NULL THEN
    IF _avg_resp < 300 THEN _score := _score + 15;
    ELSIF _avg_resp < 1800 THEN _score := _score + 10;
    ELSIF _avg_resp < 7200 THEN _score := _score + 5;
    ELSIF _avg_resp >= 86400 THEN _score := _score - 5;
    END IF;
  END IF;

  SELECT MAX(updated_at) INTO _ultima
  FROM public.vendas_leads WHERE corretor_id = _profile_id;
  _dias := CASE WHEN _ultima IS NULL THEN 999
                ELSE EXTRACT(DAY FROM (now() - _ultima))::int END;
  IF _dias > 21 THEN _score := _score - 30;
  ELSIF _dias > 14 THEN _score := _score - 20;
  ELSIF _dias > 7 THEN _score := _score - 10;
  END IF;

  RETURN LEAST(100, GREATEST(0, _score));
END $$;

CREATE OR REPLACE FUNCTION public.calc_corretor_manual_score(_lead_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  _aval public.corretor_avaliacoes%ROWTYPE;
  _score int := 0;
BEGIN
  SELECT * INTO _aval
  FROM public.corretor_avaliacoes
  WHERE lead_id = _lead_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF _aval.reuniao_alinhamento_presente THEN _score := _score + 30; END IF;
  IF _aval.mentoria_presente THEN _score := _score + 30; END IF;
  _score := _score + GREATEST(0, LEAST(40, (_aval.engajamento - 1) * 10));
  RETURN LEAST(100, GREATEST(0, _score));
END $$;

CREATE OR REPLACE FUNCTION public.calc_lead_score_captacao(_lead public.leads)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  _cfg jsonb;
  _d jsonb := COALESCE(_lead.dados_corretor, '{}'::jsonb);
  _score int := 0;
  _v text;
  _prof uuid;
  _real int;
  _manual int;
BEGIN
  IF _lead.etapa = 'fechado'::public.lead_etapa THEN
    SELECT u.id INTO _prof
    FROM auth.users u
    WHERE _lead.email IS NOT NULL AND lower(u.email) = lower(_lead.email)
    LIMIT 1;

    _real := public.calc_corretor_perf_score(_prof);
    _manual := public.calc_corretor_manual_score(_lead.id);

    IF _manual IS NULL THEN
      RETURN _real;
    END IF;
    RETURN ROUND((_real + _manual) / 2.0)::int;
  END IF;

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

CREATE OR REPLACE FUNCTION public.trg_leads_set_score()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _old_temp text;
BEGIN
  _old_temp := CASE WHEN TG_OP = 'UPDATE' THEN OLD.temperatura ELSE NULL END;
  NEW.score_temperatura := public.calc_lead_score_captacao(NEW);
  NEW.temperatura := public.temperatura_from_score(NEW.score_temperatura);
  IF _old_temp IS DISTINCT FROM NEW.temperatura THEN
    NEW.temperatura_anterior := _old_temp;
    NEW.temperatura_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_set_score ON public.leads;
CREATE TRIGGER trg_leads_set_score
  BEFORE INSERT OR UPDATE OF dados_corretor, etapa, email ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_set_score();

CREATE OR REPLACE FUNCTION public.trg_corretor_avaliacao_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _score int; _temp text; l public.leads%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id = NEW.lead_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  _score := public.calc_lead_score_captacao(l);
  _temp := public.temperatura_from_score(_score);
  PERFORM set_config('nexus.skip_updated_at', 'on', true);
  UPDATE public.leads
     SET score_temperatura = _score,
         temperatura = _temp,
         temperatura_anterior = CASE WHEN temperatura IS DISTINCT FROM _temp THEN temperatura ELSE temperatura_anterior END,
         temperatura_changed_at = CASE WHEN temperatura IS DISTINCT FROM _temp THEN now() ELSE temperatura_changed_at END
   WHERE id = NEW.lead_id;
  PERFORM set_config('nexus.skip_updated_at', 'off', true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_corretor_avaliacoes_recalc ON public.corretor_avaliacoes;
CREATE TRIGGER trg_corretor_avaliacoes_recalc
  AFTER INSERT ON public.corretor_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_corretor_avaliacao_recalc();

CREATE OR REPLACE FUNCTION public.recalc_captacao_temperatura_cooling()
RETURNS TABLE(
  lead_id uuid,
  profile_id uuid,
  executivo_id uuid,
  nome text,
  temp_anterior text,
  temp_nova text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r public.leads%ROWTYPE;
  new_score int;
  new_temp text;
  rank_old int;
  rank_new int;
  _prof uuid;
BEGIN
  FOR r IN
    SELECT l.* FROM public.leads l
    WHERE l.etapa = 'fechado'::public.lead_etapa
  LOOP
    new_score := public.calc_lead_score_captacao(r);
    new_temp  := public.temperatura_from_score(new_score);
    rank_old  := CASE r.temperatura WHEN 'quente' THEN 3 WHEN 'morno' THEN 2 WHEN 'frio' THEN 1 ELSE 0 END;
    rank_new  := CASE new_temp     WHEN 'quente' THEN 3 WHEN 'morno' THEN 2 WHEN 'frio' THEN 1 ELSE 0 END;

    IF r.score_temperatura IS DISTINCT FROM new_score OR r.temperatura IS DISTINCT FROM new_temp THEN
      PERFORM set_config('nexus.skip_updated_at', 'on', true);
      UPDATE public.leads
         SET score_temperatura = new_score,
             temperatura = new_temp,
             temperatura_anterior = CASE WHEN temperatura IS DISTINCT FROM new_temp THEN temperatura ELSE temperatura_anterior END,
             temperatura_changed_at = CASE WHEN temperatura IS DISTINCT FROM new_temp THEN now() ELSE temperatura_changed_at END
       WHERE id = r.id;
      PERFORM set_config('nexus.skip_updated_at', 'off', true);
    END IF;

    IF rank_new < rank_old AND new_temp = 'frio' THEN
      SELECT u.id INTO _prof FROM auth.users u
      WHERE r.email IS NOT NULL AND lower(u.email) = lower(r.email) LIMIT 1;
      lead_id := r.id;
      profile_id := _prof;
      executivo_id := r.responsavel_id;
      nome := r.nome;
      temp_anterior := r.temperatura;
      temp_nova := new_temp;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE r public.leads%ROWTYPE; s int; t text;
BEGIN
  FOR r IN SELECT l.* FROM public.leads l WHERE l.etapa = 'fechado'::public.lead_etapa LOOP
    s := public.calc_lead_score_captacao(r);
    t := public.temperatura_from_score(s);
    PERFORM set_config('nexus.skip_updated_at', 'on', true);
    UPDATE public.leads
       SET score_temperatura = s,
           temperatura = t
     WHERE id = r.id;
    PERFORM set_config('nexus.skip_updated_at', 'off', true);
  END LOOP;
END $$;
