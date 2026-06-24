CREATE OR REPLACE FUNCTION public.fechar_lead_vendas(_lead_id uuid, _imovel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_exec boolean;
  _exec_id uuid;
  _lead RECORD;
  _imovel RECORD;
  _comissao numeric(12,2);
  _can boolean := false;
  _etapa_ant public.vendas_etapa;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  _is_admin := has_role(_uid, 'admin'::app_role);
  _is_exec  := current_user_is_executivo();
  _exec_id  := current_user_executivo_id();

  SELECT id, corretor_id, tipo, etapa INTO _lead
    FROM vendas_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead not found'; END IF;
  _etapa_ant := _lead.etapa;

  IF _is_admin THEN
    _can := true;
  ELSIF _is_exec AND _exec_id IS NOT NULL THEN
    IF _lead.corretor_id = _uid
       OR EXISTS (SELECT 1 FROM profiles WHERE id = _lead.corretor_id AND responsavel_id = _exec_id)
    THEN _can := true; END IF;
  ELSIF _lead.corretor_id = _uid THEN
    _can := true;
  END IF;
  IF NOT _can THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id, valor_venda, valor_aluguel INTO _imovel
    FROM imoveis WHERE id = _imovel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'imóvel não encontrado'; END IF;

  IF _lead.tipo = 'compra' THEN
    IF _imovel.valor_venda IS NULL OR _imovel.valor_venda <= 0 THEN
      RAISE EXCEPTION 'imóvel sem valor de venda cadastrado';
    END IF;
    _comissao := round(_imovel.valor_venda * 0.06, 2);
  ELSIF _lead.tipo = 'locacao' THEN
    IF _imovel.valor_aluguel IS NULL OR _imovel.valor_aluguel <= 0 THEN
      RAISE EXCEPTION 'imóvel sem valor de aluguel cadastrado';
    END IF;
    _comissao := round(_imovel.valor_aluguel, 2);
  ELSE
    RAISE EXCEPTION 'tipo de lead inválido para fechamento';
  END IF;

  UPDATE vendas_leads
    SET etapa = 'fechado',
        imovel_id = _imovel_id,
        comissao = _comissao,
        fechado_em = COALESCE(fechado_em, now()),
        updated_at = now()
    WHERE id = _lead_id;

  INSERT INTO vendas_lead_historico (lead_id, user_id, etapa_anterior, etapa_nova, criado_em)
  VALUES (_lead_id, _uid, _etapa_ant, 'fechado'::public.vendas_etapa, now());

  RETURN jsonb_build_object('ok', true, 'comissao', _comissao, 'lead_id', _lead_id, 'imovel_id', _imovel_id);
END;
$$;