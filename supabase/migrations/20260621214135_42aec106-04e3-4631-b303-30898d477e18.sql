
CREATE OR REPLACE FUNCTION public.get_portfolio_stats(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _since timestamptz := now() - make_interval(days => GREATEST(_days, 1));
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    public.has_role(_uid, 'admin'::public.app_role)
    OR public.is_administrativo(_uid)
    OR public.is_corretor_vendas_ou_executivo(_uid)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'disponivel_venda', COUNT(*) FILTER (
      WHERE status IN ('disponivel_venda','disponivel')
        AND COALESCE(finalidade,'locacao') IN ('venda','ambos')
    ),
    'disponivel_locacao', COUNT(*) FILTER (
      WHERE status IN ('disponivel_locacao','disponivel')
        AND COALESCE(finalidade,'locacao') IN ('locacao','ambos')
    ),
    'disponivel_total', COUNT(*) FILTER (
      WHERE status IN ('disponivel','disponivel_locacao','disponivel_venda')
    ),
    'vendidos_periodo', COUNT(*) FILTER (
      WHERE status = 'vendido' AND updated_at >= _since
    ),
    'alugados_periodo', COUNT(*) FILTER (
      WHERE status = 'locado' AND updated_at >= _since
    ),
    'desde', _since
  )
  INTO _result
  FROM public.imoveis;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_portfolio_stats(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portfolio_stats(int) TO authenticated;
