-- Fase 1: Avaliação contínua de corretores ATIVOS (etapa Fechado da Captação)

-- 1) Tabela de avaliações (histórico acumulado, não substitui anteriores)
CREATE TABLE IF NOT EXISTS public.corretor_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  corretor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  avaliado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reuniao_alinhamento_presente boolean NOT NULL,
  mentoria_presente boolean NOT NULL,
  engajamento smallint NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corretor_avaliacoes
  ADD CONSTRAINT corretor_avaliacoes_engajamento_chk CHECK (engajamento BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_corretor_avaliacoes_lead ON public.corretor_avaliacoes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corretor_avaliacoes_profile ON public.corretor_avaliacoes(corretor_profile_id, created_at DESC);

GRANT SELECT, INSERT ON public.corretor_avaliacoes TO authenticated;
GRANT ALL ON public.corretor_avaliacoes TO service_role;

ALTER TABLE public.corretor_avaliacoes ENABLE ROW LEVEL SECURITY;

-- Leitura: admin, executivo da equipe do corretor (responsavel_id do lead = executivo do usuário),
-- o próprio avaliador, e o próprio corretor (via profile_id)
CREATE POLICY "corretor_avaliacoes_select"
ON public.corretor_avaliacoes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR avaliado_por = auth.uid()
  OR corretor_profile_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND l.responsavel_id IS NOT NULL
      AND l.responsavel_id = public.current_user_executivo_id()
  )
);

-- Inserção: admin OU executivo responsável pelo lead (etapa fechado)
CREATE POLICY "corretor_avaliacoes_insert"
ON public.corretor_avaliacoes FOR INSERT TO authenticated
WITH CHECK (
  avaliado_por = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
        AND l.etapa = 'fechado'::public.lead_etapa
        AND l.responsavel_id IS NOT NULL
        AND l.responsavel_id = public.current_user_executivo_id()
    )
  )
);

-- 2) Ponto de partida: lead na etapa 'fechado' começa com score 100 (Quente).
-- Isto sobrescreve a regra do formulário a partir do momento que o lead é fechado.
CREATE OR REPLACE FUNCTION public.calc_lead_score_captacao(_lead public.leads)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _cfg jsonb;
  _d jsonb := COALESCE(_lead.dados_corretor, '{}'::jsonb);
  _score int := 0;
  _v text;
BEGIN
  -- Corretor ativo (Fechado): regra contínua começa em 100.
  -- Avaliação manual + dados reais serão aplicados nas próximas fases.
  IF _lead.etapa = 'fechado'::public.lead_etapa THEN
    RETURN 100;
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
END $function$;

-- 3) Backfill — todo lead já em 'fechado' passa a 100/quente
UPDATE public.leads
   SET score_temperatura = 100,
       temperatura = 'quente'
 WHERE etapa = 'fechado'::public.lead_etapa
   AND (score_temperatura IS DISTINCT FROM 100 OR temperatura IS DISTINCT FROM 'quente');
