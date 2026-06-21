
-- Normalização de telefone (últimos 11 dígitos)
CREATE OR REPLACE FUNCTION public.normalize_telefone(_tel text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _tel IS NULL OR length(regexp_replace(_tel, '\D', '', 'g')) = 0 THEN NULL
    ELSE right(regexp_replace(_tel, '\D', '', 'g'), 11)
  END;
$$;

-- Normalização de CPF (só dígitos)
CREATE OR REPLACE FUNCTION public.normalize_cpf(_cpf text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _cpf IS NULL OR length(regexp_replace(_cpf, '\D', '', 'g')) = 0 THEN NULL
    ELSE regexp_replace(_cpf, '\D', '', 'g')
  END;
$$;

-- Busca unificada Lead 360° (somente Admin)
CREATE OR REPLACE FUNCTION public.buscar_lead_360(_telefone text DEFAULT NULL, _cpf text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tel text := public.normalize_telefone(_telefone);
  _cpf_norm text := public.normalize_cpf(_cpf);
  _result jsonb;
  _total int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _tel IS NULL AND _cpf_norm IS NULL THEN
    RAISE EXCEPTION 'informe telefone ou cpf';
  END IF;

  WITH
  cap AS (
    SELECT
      l.id, l.nome, l.telefone, l.email, l.regiao::text, l.etapa::text,
      l.origem::text, l.responsavel_id, r.nome AS responsavel_nome,
      l.created_at, l.updated_at, l.fechado_em, l.is_corretor,
      l.descredenciado_em
    FROM public.leads l
    LEFT JOIN public.responsaveis r ON r.id = l.responsavel_id
    WHERE (_tel IS NOT NULL AND public.normalize_telefone(l.telefone) = _tel)
  ),
  vds AS (
    SELECT
      vl.id, vl.nome, vl.telefone, vl.email, vl.regiao::text, vl.etapa::text,
      vl.tipo::text, vl.origem::text, vl.valor,
      vl.corretor_id, p.nome AS corretor_nome,
      vl.created_at, vl.updated_at, vl.fechado_em
    FROM public.vendas_leads vl
    LEFT JOIN public.profiles p ON p.id = vl.corretor_id
    WHERE (_tel IS NOT NULL AND public.normalize_telefone(vl.telefone) = _tel)
  ),
  fin AS (
    SELECT
      f.id, f.nome, f.telefone, f.email, f.status,
      f.imovel_endereco, f.imovel_valor,
      f.criado_por, p.nome AS criado_por_nome,
      f.created_at, f.updated_at
    FROM public.financiamentos f
    LEFT JOIN public.profiles p ON p.id = f.criado_por
    WHERE (_tel IS NOT NULL AND public.normalize_telefone(f.telefone) = _tel)
       OR (_cpf_norm IS NOT NULL AND public.normalize_cpf(f.cpf) = _cpf_norm)
  ),
  ctr AS (
    SELECT
      c.id, c.locatario_nome AS nome, c.locatario_telefone AS telefone,
      c.locatario_email AS email, c.status::text,
      c.data_inicio, c.data_fim, c.valor_aluguel,
      c.imovel_id, c.created_at, c.updated_at
    FROM public.contratos c
    WHERE (_tel IS NOT NULL AND public.normalize_telefone(c.locatario_telefone) = _tel)
       OR (_cpf_norm IS NOT NULL AND public.normalize_cpf(c.locatario_cpf) = _cpf_norm)
  ),
  cand AS (
    SELECT
      ca.id, ca.nome, ca.telefone, ca.email, ca.creci, ca.regiao::text,
      ca.status::text, ca.responsavel_id, r.nome AS responsavel_nome,
      ca.created_at, ca.updated_at, ca.arquivado_em
    FROM public.candidatos ca
    LEFT JOIN public.responsaveis r ON r.id = ca.responsavel_id
    WHERE (_tel IS NOT NULL AND public.normalize_telefone(ca.telefone) = _tel)
       OR (_cpf_norm IS NOT NULL AND public.normalize_cpf(ca.cpf) = _cpf_norm)
  ),
  -- visitas vinculadas a leads de vendas encontrados
  vis AS (
    SELECT
      vv.id, vv.data_inicio, vv.duracao_min, vv.status::text,
      vv.comparecimento::text, vv.imovel_id, vv.lead_id,
      vv.corretor_id, p.nome AS corretor_nome,
      vv.created_at
    FROM public.vendas_visitas vv
    LEFT JOIN public.profiles p ON p.id = vv.corretor_id
    WHERE vv.lead_id IN (SELECT id FROM vds)
  ),
  -- reuniões em que o lead participa (captação ou vendas)
  reu AS (
    SELECT DISTINCT
      r.id, r.titulo, r.descricao, r.data_inicio, r.duracao_min,
      r.tipo::text, r.status::text, r.resultado, r.criado_por,
      p.nome AS criado_por_nome, r.created_at
    FROM public.reunioes r
    JOIN public.reuniao_participantes rp ON rp.reuniao_id = r.id
    LEFT JOIN public.profiles p ON p.id = r.criado_por
    WHERE rp.lead_id IN (SELECT id FROM cap)
       OR rp.lead_id IN (SELECT id FROM vds)
  )
  SELECT jsonb_build_object(
    'criterios', jsonb_build_object('telefone', _tel, 'cpf', _cpf_norm),
    'gerado_em', now(),
    'captacao', (SELECT COALESCE(jsonb_agg(to_jsonb(cap) ORDER BY created_at DESC), '[]'::jsonb) FROM cap),
    'vendas', (SELECT COALESCE(jsonb_agg(to_jsonb(vds) ORDER BY created_at DESC), '[]'::jsonb) FROM vds),
    'financiamentos', (SELECT COALESCE(jsonb_agg(to_jsonb(fin) ORDER BY created_at DESC), '[]'::jsonb) FROM fin),
    'contratos', (SELECT COALESCE(jsonb_agg(to_jsonb(ctr) ORDER BY created_at DESC), '[]'::jsonb) FROM ctr),
    'candidatos', (SELECT COALESCE(jsonb_agg(to_jsonb(cand) ORDER BY created_at DESC), '[]'::jsonb) FROM cand),
    'visitas', (SELECT COALESCE(jsonb_agg(to_jsonb(vis) ORDER BY data_inicio DESC), '[]'::jsonb) FROM vis),
    'reunioes', (SELECT COALESCE(jsonb_agg(to_jsonb(reu) ORDER BY data_inicio DESC), '[]'::jsonb) FROM reu),
    'totais', jsonb_build_object(
      'captacao', (SELECT count(*) FROM cap),
      'vendas', (SELECT count(*) FROM vds),
      'financiamentos', (SELECT count(*) FROM fin),
      'contratos', (SELECT count(*) FROM ctr),
      'candidatos', (SELECT count(*) FROM cand),
      'visitas', (SELECT count(*) FROM vis),
      'reunioes', (SELECT count(*) FROM reu)
    )
  ) INTO _result;

  _total := (
    COALESCE((_result->'totais'->>'captacao')::int,0) +
    COALESCE((_result->'totais'->>'vendas')::int,0) +
    COALESCE((_result->'totais'->>'financiamentos')::int,0) +
    COALESCE((_result->'totais'->>'contratos')::int,0) +
    COALESCE((_result->'totais'->>'candidatos')::int,0)
  );

  PERFORM public.log_audit(
    'lead_360_busca',
    'multi',
    NULL,
    NULL,
    jsonb_build_object('telefone', _tel, 'cpf', _cpf_norm, 'total_pessoas_encontradas', _total),
    jsonb_build_object('origem', 'buscar_lead_360')
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_telefone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_cpf(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_lead_360(text, text) TO authenticated;
