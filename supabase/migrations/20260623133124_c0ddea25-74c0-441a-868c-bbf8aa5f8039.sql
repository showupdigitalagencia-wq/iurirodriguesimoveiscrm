-- Atualiza get_metas_progresso_lista para sinalizar quem é executivo
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
    SELECT
      p.id,
      p.nome,
      r.nome AS equipe,
      EXISTS (
        SELECT 1 FROM public.responsaveis r2
        WHERE r2.id = p.responsavel_id
          AND r2.ativo = true
          AND lower(split_part(trim(r2.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
      ) AS is_executivo
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
      'is_executivo', c.is_executivo,
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
    ) ORDER BY c.is_executivo DESC, c.nome), '[]'::jsonb)
  ) INTO _result
  FROM corretores c
  LEFT JOIN metas m ON m.corretor_id = c.id
  LEFT JOIN realizados r ON r.corretor_id = c.id;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_metas_progresso_lista(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_metas_progresso_lista(int, int) TO authenticated;