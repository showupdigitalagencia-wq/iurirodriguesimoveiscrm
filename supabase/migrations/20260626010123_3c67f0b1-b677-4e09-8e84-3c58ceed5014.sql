
-- 1) Colunas para rastreio de tendência
ALTER TABLE public.vendas_leads
  ADD COLUMN IF NOT EXISTS temperatura_anterior text,
  ADD COLUMN IF NOT EXISTS temperatura_changed_at timestamptz;

-- 2) Trigger de score: registra anterior quando a categoria muda
CREATE OR REPLACE FUNCTION public.trg_vendas_leads_set_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE _old_temp text;
BEGIN
  _old_temp := CASE WHEN TG_OP = 'UPDATE' THEN OLD.temperatura ELSE NULL END;
  NEW.score_temperatura := public.calc_lead_score_vendas(NEW);
  NEW.temperatura := public.temperatura_from_score(NEW.score_temperatura);
  IF _old_temp IS DISTINCT FROM NEW.temperatura THEN
    NEW.temperatura_anterior := _old_temp;
    NEW.temperatura_changed_at := now();
  END IF;
  RETURN NEW;
END $function$;

-- 3) Trigger updated_at específico de vendas_leads que respeita flag de sessão
CREATE OR REPLACE FUNCTION public.vendas_leads_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('nexus.skip_updated_at', true) = 'on' THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS vendas_leads_updated_at ON public.vendas_leads;
CREATE TRIGGER vendas_leads_updated_at
  BEFORE UPDATE ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.vendas_leads_bump_updated_at();

-- 4) RPC: recalcula e detecta esfriamento por inatividade
CREATE OR REPLACE FUNCTION public.recalc_vendas_temperatura_cooling()
RETURNS TABLE(lead_id uuid, corretor_id uuid, nome text, temp_anterior text, temp_nova text, dias_inativo int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  new_score int;
  new_temp text;
  ultima timestamptz;
  dias int;
  rank_old int;
  rank_new int;
BEGIN
  FOR r IN
    SELECT * FROM public.vendas_leads
    WHERE etapa NOT IN ('fechado'::public.vendas_etapa, 'perdido'::public.vendas_etapa)
  LOOP
    new_score := public.calc_lead_score_vendas(r);
    new_temp  := public.temperatura_from_score(new_score);
    rank_old  := CASE r.temperatura WHEN 'quente' THEN 3 WHEN 'morno' THEN 2 WHEN 'frio' THEN 1 ELSE 0 END;
    rank_new  := CASE new_temp     WHEN 'quente' THEN 3 WHEN 'morno' THEN 2 WHEN 'frio' THEN 1 ELSE 0 END;
    ultima := GREATEST(COALESCE(r.ultima_mensagem_em, r.updated_at), r.updated_at);
    dias   := EXTRACT(DAY FROM (now() - ultima))::int;

    -- emitir cooling somente quando a queda for por inatividade (>14 dias)
    IF rank_new < rank_old AND dias > 14 THEN
      lead_id := r.id;
      corretor_id := r.corretor_id;
      nome := r.nome;
      temp_anterior := r.temperatura;
      temp_nova := new_temp;
      dias_inativo := dias;
      RETURN NEXT;
    END IF;

    -- persistir score/temperatura sem mexer em updated_at
    IF r.score_temperatura IS DISTINCT FROM new_score OR r.temperatura IS DISTINCT FROM new_temp THEN
      PERFORM set_config('nexus.skip_updated_at', 'on', true);
      UPDATE public.vendas_leads
         SET score_temperatura = new_score,
             temperatura = new_temp,
             temperatura_anterior = CASE WHEN temperatura IS DISTINCT FROM new_temp THEN temperatura ELSE temperatura_anterior END,
             temperatura_changed_at = CASE WHEN temperatura IS DISTINCT FROM new_temp THEN now() ELSE temperatura_changed_at END
       WHERE id = r.id;
      PERFORM set_config('nexus.skip_updated_at', 'off', true);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.recalc_vendas_temperatura_cooling() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_vendas_temperatura_cooling() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_vendas_temperatura_cooling() TO service_role;
