
-- 1) Tabela de log de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  status_code integer,
  sucesso boolean NOT NULL DEFAULT false,
  erro text,
  payload_resumo jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_log_fonte_criado_idx ON public.webhook_log (fonte, criado_em DESC);
CREATE INDEX IF NOT EXISTS webhook_log_criado_idx ON public.webhook_log (criado_em DESC);

GRANT SELECT ON public.webhook_log TO authenticated;
GRANT ALL ON public.webhook_log TO service_role;

ALTER TABLE public.webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_log_admin_select"
  ON public.webhook_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Função consolidada de saúde do sistema
CREATE OR REPLACE FUNCTION public.get_saude_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH push_24h AS (
    SELECT
      COUNT(*) FILTER (WHERE tipo = 'push') AS total,
      COUNT(*) FILTER (WHERE tipo = 'push' AND status IN ('enviado','entregue','sucesso','ok','delivered')) AS ok
    FROM notificacoes
    WHERE created_at >= now() - interval '24 hours'
  ),
  push_7d AS (
    SELECT
      COUNT(*) FILTER (WHERE tipo = 'push') AS total,
      COUNT(*) FILTER (WHERE tipo = 'push' AND status IN ('enviado','entregue','sucesso','ok','delivered')) AS ok
    FROM notificacoes
    WHERE created_at >= now() - interval '7 days'
  ),
  fontes_lista AS (
    SELECT unnest(ARRAY['zap_imoveis','olx','site','whatsapp_empresa','facebook']) AS fonte
  ),
  ultima_msg_cap AS (
    SELECT origem::text AS fonte, MAX(created_at) AS ultima
    FROM leads GROUP BY origem
  ),
  ultima_msg_vendas AS (
    SELECT origem::text AS fonte, MAX(created_at) AS ultima
    FROM vendas_leads GROUP BY origem
  ),
  ultima_por_fonte AS (
    SELECT f.fonte,
      GREATEST(
        COALESCE((SELECT ultima FROM ultima_msg_cap u WHERE u.fonte = f.fonte), 'epoch'::timestamptz),
        COALESCE((SELECT ultima FROM ultima_msg_vendas u WHERE u.fonte = f.fonte), 'epoch'::timestamptz),
        COALESCE((SELECT MAX(criado_em) FROM webhook_log w WHERE w.fonte = f.fonte AND w.sucesso = true), 'epoch'::timestamptz)
      ) AS ultima
    FROM fontes_lista f
  ),
  erros_24h AS (
    SELECT fonte, COUNT(*) AS qtd
    FROM webhook_log
    WHERE criado_em >= now() - interval '24 hours' AND sucesso = false
    GROUP BY fonte
  ),
  webhooks AS (
    SELECT jsonb_agg(jsonb_build_object(
      'fonte', f.fonte,
      'ultima', NULLIF(uf.ultima, 'epoch'::timestamptz),
      'erros_24h', COALESCE((SELECT qtd FROM erros_24h e WHERE e.fonte = f.fonte), 0)
    ) ORDER BY f.fonte) AS list
    FROM fontes_lista f
    LEFT JOIN ultima_por_fonte uf ON uf.fonte = f.fonte
  ),
  proximos_dias AS (
    SELECT d::date AS dia
    FROM generate_series(current_date, current_date + interval '6 days', interval '1 day') d
  ),
  plantao AS (
    SELECT jsonb_agg(jsonb_build_object(
      'data', pd.dia,
      'corretor_id', pe.corretor_id,
      'sem_escala', (pe.corretor_id IS NULL)
    ) ORDER BY pd.dia) AS list,
    COUNT(*) FILTER (WHERE pe.corretor_id IS NULL) AS dias_vazios
    FROM proximos_dias pd
    LEFT JOIN plantao_escala pe ON pe.data = pd.dia
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'push', jsonb_build_object(
      '24h', jsonb_build_object(
        'total', (SELECT total FROM push_24h),
        'ok',    (SELECT ok    FROM push_24h),
        'pct',   CASE WHEN (SELECT total FROM push_24h) > 0
                  THEN round(((SELECT ok FROM push_24h)::numeric / (SELECT total FROM push_24h)) * 100, 1)
                  ELSE NULL END
      ),
      '7d', jsonb_build_object(
        'total', (SELECT total FROM push_7d),
        'ok',    (SELECT ok    FROM push_7d),
        'pct',   CASE WHEN (SELECT total FROM push_7d) > 0
                  THEN round(((SELECT ok FROM push_7d)::numeric / (SELECT total FROM push_7d)) * 100, 1)
                  ELSE NULL END
      )
    ),
    'webhooks', (SELECT list FROM webhooks),
    'plantao', jsonb_build_object(
      'dias', (SELECT list FROM plantao),
      'dias_vazios', (SELECT dias_vazios FROM plantao)
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_saude_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_saude_sistema() TO authenticated;
