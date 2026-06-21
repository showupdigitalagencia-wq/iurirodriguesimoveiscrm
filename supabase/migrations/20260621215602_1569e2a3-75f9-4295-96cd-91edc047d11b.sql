
CREATE OR REPLACE FUNCTION public.get_vendas_relatorio(_from timestamptz, _to timestamptz)
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
  _prev_from timestamptz;
  _prev_to timestamptz;
  _range_secs bigint;
  _allowed uuid[];
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  _is_admin := has_role(_uid, 'admin'::app_role);
  _is_exec := current_user_is_executivo();
  _exec_id := current_user_executivo_id();

  -- Define quem o usuário pode ver
  IF _is_admin THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  ELSIF _is_exec AND _exec_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _exec_id AND ativo = true;
    _allowed := COALESCE(_allowed, ARRAY[]::uuid[]) || _uid;
  ELSE
    _allowed := ARRAY[_uid];
  END IF;

  _range_secs := EXTRACT(EPOCH FROM (_to - _from))::bigint;
  _prev_to := _from;
  _prev_from := _from - make_interval(secs => _range_secs);

  WITH base AS (
    SELECT vl.*
    FROM vendas_leads vl
    WHERE vl.corretor_id = ANY(_allowed)
      AND vl.created_at >= _from AND vl.created_at <= _to
  ),
  prev AS (
    SELECT vl.*
    FROM vendas_leads vl
    WHERE vl.corretor_id = ANY(_allowed)
      AND vl.created_at >= _prev_from AND vl.created_at < _prev_to
  ),
  por_corretor AS (
    SELECT
      p.id AS corretor_id,
      p.nome,
      p.responsavel_id,
      COUNT(b.id) AS recebidos,
      COUNT(b.id) FILTER (WHERE b.atribuicao_status = 'aceito') AS atendidos,
      COUNT(b.id) FILTER (WHERE b.etapa = 'fechado' AND b.tipo = 'compra') AS vendas,
      COUNT(b.id) FILTER (WHERE b.etapa = 'fechado' AND b.tipo = 'locacao') AS locacoes,
      COUNT(b.id) FILTER (WHERE b.etapa = 'fechado') AS fechados,
      COALESCE(SUM(b.valor) FILTER (WHERE b.etapa = 'fechado'), 0) AS receita
    FROM profiles p
    LEFT JOIN base b ON b.corretor_id = p.id
    WHERE p.id = ANY(_allowed)
    GROUP BY p.id, p.nome, p.responsavel_id
  ),
  por_equipe AS (
    SELECT
      COALESCE(r.id::text, 'sem_equipe') AS equipe_id,
      COALESCE(r.nome, 'Sem equipe') AS equipe_nome,
      SUM(pc.recebidos) AS recebidos,
      SUM(pc.atendidos) AS atendidos,
      SUM(pc.vendas) AS vendas,
      SUM(pc.locacoes) AS locacoes,
      SUM(pc.fechados) AS fechados,
      SUM(pc.receita) AS receita
    FROM por_corretor pc
    LEFT JOIN responsaveis r ON r.id = pc.responsavel_id
    GROUP BY r.id, r.nome
  ),
  plantao_corretores AS (
    SELECT
      p.id AS corretor_id,
      p.nome,
      COUNT(b.id) FILTER (WHERE b.plantao_dia IS NOT NULL) AS recebidos,
      COUNT(b.id) FILTER (WHERE b.plantao_dia IS NOT NULL AND b.atribuicao_status = 'aceito') AS atendidos,
      (SELECT COUNT(*) FROM plantao_log pl
        WHERE pl.corretor_id = p.id
          AND pl.motivo = 'redirecionamento_demora'
          AND pl.criado_em >= _from AND pl.criado_em <= _to) AS redirecionados,
      (SELECT COUNT(*) FROM plantao_log pl
        WHERE pl.corretor_id = p.id
          AND pl.motivo = 'reincidencia'
          AND pl.criado_em >= _from AND pl.criado_em <= _to) AS reatribuicoes
    FROM profiles p
    LEFT JOIN base b ON b.corretor_id = p.id
    WHERE p.id = ANY(_allowed) AND p.plantao_elegivel = true
    GROUP BY p.id, p.nome
  ),
  origem_atual AS (
    SELECT origem::text AS canal, COUNT(*) AS qtd FROM base GROUP BY origem
  ),
  comp_atual AS (
    SELECT
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'compra') AS vendas,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'locacao') AS locacoes,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
      COUNT(*) AS total_leads
    FROM base
  ),
  comp_prev AS (
    SELECT
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'compra') AS vendas,
      COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'locacao') AS locacoes,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
      COUNT(*) AS total_leads
    FROM prev
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to, 'prev_from', _prev_from, 'prev_to', _prev_to),
    'escopo', jsonb_build_object('is_admin', _is_admin, 'is_exec', _is_exec, 'usuarios', COALESCE(array_length(_allowed,1), 0)),
    'corretores', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', corretor_id, 'nome', nome,
        'recebidos', recebidos, 'atendidos', atendidos,
        'vendas', vendas, 'locacoes', locacoes,
        'fechados', fechados, 'receita', receita,
        'conversao', CASE WHEN recebidos > 0 THEN round((fechados::numeric / recebidos) * 100, 1) ELSE 0 END
      ) ORDER BY fechados DESC, recebidos DESC), '[]'::jsonb) FROM por_corretor),
    'equipes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', equipe_id, 'nome', equipe_nome,
        'recebidos', recebidos, 'atendidos', atendidos,
        'vendas', vendas, 'locacoes', locacoes,
        'fechados', fechados, 'receita', receita,
        'conversao', CASE WHEN recebidos > 0 THEN round((fechados::numeric / recebidos) * 100, 1) ELSE 0 END
      ) ORDER BY fechados DESC, recebidos DESC), '[]'::jsonb) FROM por_equipe),
    'plantao', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', corretor_id, 'nome', nome,
        'recebidos', recebidos, 'atendidos', atendidos,
        'redirecionados', redirecionados, 'reatribuicoes', reatribuicoes
      ) ORDER BY recebidos DESC), '[]'::jsonb) FROM plantao_corretores),
    'origem', (SELECT COALESCE(jsonb_agg(jsonb_build_object('canal', canal, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb) FROM origem_atual),
    'comparacao', jsonb_build_object(
      'atual', (SELECT to_jsonb(comp_atual) FROM comp_atual),
      'anterior', (SELECT to_jsonb(comp_prev) FROM comp_prev)
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendas_relatorio(timestamptz, timestamptz) TO authenticated;
