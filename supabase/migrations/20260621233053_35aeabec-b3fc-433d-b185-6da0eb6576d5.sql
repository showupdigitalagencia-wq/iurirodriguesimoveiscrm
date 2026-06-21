CREATE OR REPLACE FUNCTION public.get_comparativo_regioes(
  _from timestamptz,
  _to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_exec boolean;
  _exec_id uuid;
  _allowed uuid[];
  _result jsonb;
  _prev_from timestamptz;
  _prev_to timestamptz;
  _range_secs bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _is_admin := has_role(_uid, 'admin'::app_role);
  _is_exec := current_user_is_executivo();
  _exec_id := current_user_executivo_id();

  IF _is_admin THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  ELSIF _is_exec AND _exec_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _exec_id AND ativo = true;
    _allowed := COALESCE(_allowed, ARRAY[]::uuid[]) || _uid;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;
  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  _range_secs := EXTRACT(EPOCH FROM (_to - _from))::bigint;
  _prev_to := _from;
  _prev_from := _from - make_interval(secs => _range_secs);

  WITH base AS (
    SELECT vl.regiao::text AS regiao, vl.etapa::text AS etapa, vl.tipo::text AS tipo,
           vl.valor, vl.atribuicao_status, vl.first_response_at, vl.created_at
    FROM vendas_leads vl
    WHERE vl.corretor_id = ANY(_allowed)
      AND vl.created_at >= _from AND vl.created_at <= _to
  ),
  prev AS (
    SELECT vl.regiao::text AS regiao, vl.etapa::text AS etapa
    FROM vendas_leads vl
    WHERE vl.corretor_id = ANY(_allowed)
      AND vl.created_at >= _prev_from AND vl.created_at < _prev_to
  ),
  por_regiao AS (
    SELECT regiao,
      COUNT(*) AS recebidos,
      COUNT(*) FILTER (WHERE atribuicao_status = 'aceito') AS atendidos,
      COUNT(*) FILTER (WHERE etapa = 'fechado') AS fechados,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'compra') AS vendas,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'locacao') AS locacoes,
      COUNT(*) FILTER (WHERE etapa = 'perdido') AS perdidos,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))) FILTER (WHERE first_response_at IS NOT NULL) AS tempo_medio_resposta_seg
    FROM base
    GROUP BY regiao
  ),
  prev_regiao AS (
    SELECT regiao,
      COUNT(*) AS recebidos,
      COUNT(*) FILTER (WHERE etapa = 'fechado') AS fechados
    FROM prev
    GROUP BY regiao
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to, 'prev_from', _prev_from, 'prev_to', _prev_to),
    'escopo', jsonb_build_object('is_admin', _is_admin, 'is_exec', _is_exec, 'usuarios', COALESCE(array_length(_allowed,1),0)),
    'regioes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'regiao', pr.regiao,
        'recebidos', pr.recebidos,
        'atendidos', pr.atendidos,
        'fechados', pr.fechados,
        'vendas', pr.vendas,
        'locacoes', pr.locacoes,
        'perdidos', pr.perdidos,
        'receita', pr.receita,
        'ticket_medio', CASE WHEN pr.fechados > 0 THEN round(pr.receita / pr.fechados, 2) ELSE 0 END,
        'conversao', CASE WHEN pr.recebidos > 0 THEN round((pr.fechados::numeric / pr.recebidos) * 100, 1) ELSE 0 END,
        'tempo_medio_resposta_seg', pr.tempo_medio_resposta_seg,
        'anterior', jsonb_build_object(
          'recebidos', COALESCE((SELECT recebidos FROM prev_regiao p WHERE p.regiao = pr.regiao), 0),
          'fechados', COALESCE((SELECT fechados FROM prev_regiao p WHERE p.regiao = pr.regiao), 0)
        )
      ) ORDER BY pr.fechados DESC, pr.recebidos DESC)
      FROM por_regiao pr
    ), '[]'::jsonb),
    'totais', (SELECT jsonb_build_object(
      'recebidos', COALESCE(SUM(recebidos),0),
      'fechados', COALESCE(SUM(fechados),0),
      'vendas', COALESCE(SUM(vendas),0),
      'locacoes', COALESCE(SUM(locacoes),0),
      'receita', COALESCE(SUM(receita),0)
    ) FROM por_regiao)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_comparativo_regioes(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comparativo_regioes(timestamptz, timestamptz) TO authenticated;