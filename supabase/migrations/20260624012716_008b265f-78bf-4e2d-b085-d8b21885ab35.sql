
DROP FUNCTION IF EXISTS public.list_visitas_nao_compareceu(timestamptz, timestamptz, text, uuid);

CREATE OR REPLACE FUNCTION public.list_visitas_nao_compareceu(
  _from timestamptz,
  _to timestamptz,
  _scope text DEFAULT 'auto',
  _target_id uuid DEFAULT NULL,
  _status text DEFAULT 'nao_compareceu'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_exec boolean;
  _exec_id uuid;
  _allowed uuid[];
  _eff_scope text;
  _eff_target uuid;
  _eff_status text;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _is_admin := has_role(_uid, 'admin'::app_role);
  _is_exec := current_user_is_executivo();
  _exec_id := current_user_executivo_id();

  _eff_status := COALESCE(_status, 'nao_compareceu');
  IF _eff_status NOT IN ('nao_compareceu', 'realizada') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  _eff_scope := COALESCE(_scope, 'auto');
  _eff_target := _target_id;
  IF _eff_scope = 'auto' THEN
    IF _is_admin THEN _eff_scope := 'all';
    ELSE _eff_scope := 'me'; END IF;
  END IF;

  IF _eff_scope = 'me' THEN
    _allowed := ARRAY[_uid];
  ELSIF _eff_scope = 'user' THEN
    IF _eff_target IS NULL THEN RAISE EXCEPTION 'target required'; END IF;
    IF _is_admin THEN
      _allowed := ARRAY[_eff_target];
    ELSIF _is_exec AND _exec_id IS NOT NULL THEN
      IF _eff_target = _uid OR EXISTS (
        SELECT 1 FROM profiles WHERE id = _eff_target AND responsavel_id = _exec_id
      ) THEN _allowed := ARRAY[_eff_target];
      ELSE RAISE EXCEPTION 'forbidden'; END IF;
    ELSE
      IF _eff_target <> _uid THEN RAISE EXCEPTION 'forbidden'; END IF;
      _allowed := ARRAY[_uid];
    END IF;
  ELSIF _eff_scope = 'team' THEN
    IF _is_admin THEN
      IF _eff_target IS NULL THEN RAISE EXCEPTION 'team target required'; END IF;
      SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _eff_target AND ativo = true;
    ELSIF _is_exec AND _exec_id IS NOT NULL THEN
      IF _eff_target IS NOT NULL AND _eff_target <> _exec_id THEN RAISE EXCEPTION 'forbidden'; END IF;
      SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _exec_id AND ativo = true;
      _allowed := COALESCE(_allowed, ARRAY[]::uuid[]) || _uid;
    ELSE RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF _eff_scope = 'all' THEN
    IF NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  ELSE RAISE EXCEPTION 'invalid scope'; END IF;

  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.data_inicio DESC), '[]'::jsonb)
  INTO _result
  FROM (
    SELECT
      vv.id AS visita_id,
      vv.data_inicio,
      vv.endereco,
      vv.observacoes,
      vv.confirmada_em,
      vv.lead_id,
      vl.nome AS lead_nome,
      vl.telefone AS lead_telefone,
      vl.tipo AS lead_tipo,
      vl.etapa AS lead_etapa,
      vv.imovel_id,
      im.codigo AS imovel_codigo,
      NULLIF(concat_ws(', ',
        NULLIF(concat_ws(' ', im.rua, im.numero), ''),
        im.bairro, im.cidade
      ), '') AS imovel_endereco,
      vv.corretor_id,
      pr.nome AS corretor_nome
    FROM vendas_visitas vv
    JOIN vendas_leads vl ON vl.id = vv.lead_id
    LEFT JOIN imoveis im ON im.id = vv.imovel_id
    LEFT JOIN profiles pr ON pr.id = vv.corretor_id
    WHERE vv.comparecimento = _eff_status
      AND vv.corretor_id = ANY(_allowed)
      AND vv.data_inicio >= _from
      AND vv.data_inicio <= _to
  ) t;

  RETURN jsonb_build_object(
    'scope', _eff_scope,
    'status', _eff_status,
    'total', jsonb_array_length(_result),
    'items', _result
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_visitas_nao_compareceu(timestamptz, timestamptz, text, uuid, text) TO authenticated;
