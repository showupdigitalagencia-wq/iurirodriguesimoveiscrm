
-- Restringir metas e comparativo de regiões a admin

-- 1) get_metas_progresso_lista: somente admin
CREATE OR REPLACE FUNCTION public.get_metas_progresso_lista(_ano int, _mes int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed uuid[];
  _from timestamptz;
  _to timestamptz;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  _from := make_timestamptz(_ano, _mes, 1, 0, 0, 0);
  _to := _from + interval '1 month';

  WITH corretores AS (
    SELECT p.id, p.nome, r.nome AS equipe
    FROM profiles p
    LEFT JOIN responsaveis r ON r.id = p.responsavel_id
    WHERE p.id = ANY(_allowed)
  ),
  metas AS (
    SELECT corretor_id, meta_vendas, meta_locacoes, meta_receita, meta_leads_atendidos
    FROM metas_mensais WHERE ano = _ano AND mes = _mes
  ),
  realizados AS (
    SELECT corretor_id,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'compra') AS vendas,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'locacao') AS locacoes,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
      COUNT(*) FILTER (WHERE atribuicao_status = 'aceito') AS leads_atendidos
    FROM vendas_leads
    WHERE corretor_id = ANY(_allowed) AND created_at >= _from AND created_at < _to
    GROUP BY corretor_id
  )
  SELECT jsonb_build_object(
    'ano', _ano, 'mes', _mes,
    'corretores', COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'equipe', c.equipe,
      'meta', jsonb_build_object(
        'definida', m.corretor_id IS NOT NULL,
        'vendas', COALESCE(m.meta_vendas, 0),
        'locacoes', COALESCE(m.meta_locacoes, 0),
        'receita', COALESCE(m.meta_receita, 0),
        'leads_atendidos', COALESCE(m.meta_leads_atendidos, 0)
      ),
      'realizado', jsonb_build_object(
        'vendas', COALESCE(r.vendas, 0),
        'locacoes', COALESCE(r.locacoes, 0),
        'receita', COALESCE(r.receita, 0),
        'leads_atendidos', COALESCE(r.leads_atendidos, 0)
      )
    ) ORDER BY c.nome), '[]'::jsonb)
  ) INTO _result
  FROM corretores c
  LEFT JOIN metas m ON m.corretor_id = c.id
  LEFT JOIN realizados r ON r.corretor_id = c.id;

  RETURN _result;
END;
$$;

-- 2) Políticas de metas_mensais: insert/update apenas admin
DROP POLICY IF EXISTS "metas_insert" ON public.metas_mensais;
CREATE POLICY "metas_insert" ON public.metas_mensais
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM now())::int * 100 + EXTRACT(MONTH FROM now())::int)
  );

DROP POLICY IF EXISTS "metas_update" ON public.metas_mensais;
CREATE POLICY "metas_update" ON public.metas_mensais
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM now())::int * 100 + EXTRACT(MONTH FROM now())::int)
  );

-- (SELECT segue como está: admin, próprio corretor, ou executivo da equipe — para que
-- o corretor continue vendo o próprio progresso no Dashboard.)

-- 3) get_comparativo_regioes: somente admin
CREATE OR REPLACE FUNCTION public.get_comparativo_regioes(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed uuid[];
  _result jsonb;
  _prev_from timestamptz;
  _prev_to timestamptz;
  _range_secs bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  _range_secs := EXTRACT(EPOCH FROM (_to - _from))::bigint;
  _prev_to := _from;
  _prev_from := _from - make_interval(secs => _range_secs);

  WITH base AS (
    SELECT vl.regiao::text AS regiao, vl.etapa::text AS etapa, vl.tipo::text AS tipo,
           vl.comissao, vl.atribuicao_status, vl.first_response_at, vl.created_at
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
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND comissao IS NULL) AS fechados_sem_comissao,
      COALESCE(SUM(comissao) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))) FILTER (WHERE first_response_at IS NOT NULL) AS tempo_medio_resposta_seg
    FROM base GROUP BY regiao
  ),
  prev_regiao AS (
    SELECT regiao, COUNT(*) AS recebidos, COUNT(*) FILTER (WHERE etapa = 'fechado') AS fechados
    FROM prev GROUP BY regiao
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to, 'prev_from', _prev_from, 'prev_to', _prev_to),
    'escopo', jsonb_build_object('is_admin', true, 'is_exec', false, 'usuarios', COALESCE(array_length(_allowed,1),0)),
    'regioes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'regiao', pr.regiao,
        'recebidos', pr.recebidos, 'atendidos', pr.atendidos,
        'fechados', pr.fechados, 'vendas', pr.vendas, 'locacoes', pr.locacoes,
        'perdidos', pr.perdidos,
        'fechados_sem_comissao', pr.fechados_sem_comissao,
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
      'fechados_sem_comissao', COALESCE(SUM(fechados_sem_comissao),0),
      'receita', COALESCE(SUM(receita),0)
    ) FROM por_regiao)
  ) INTO _result;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_comparativo_regioes(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comparativo_regioes(timestamptz, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.get_metas_progresso_lista(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_metas_progresso_lista(int, int) TO authenticated;
