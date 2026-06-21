
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.satisfacao_status AS ENUM ('pendente','enviada','respondida','sem_resposta_valida','falha_envio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.pesquisas_satisfacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.vendas_leads(id) ON DELETE CASCADE,
  corretor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  status public.satisfacao_status NOT NULL DEFAULT 'pendente',
  enviada_em timestamptz,
  expira_em timestamptz,
  respondida_em timestamptz,
  nota smallint CHECK (nota IS NULL OR (nota BETWEEN 1 AND 5)),
  comentario text,
  tentativas int NOT NULL DEFAULT 0,
  erro_envio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_satisfacao_lead ON public.pesquisas_satisfacao(lead_id);
CREATE INDEX IF NOT EXISTS idx_pesquisas_satisfacao_status ON public.pesquisas_satisfacao(status);
CREATE INDEX IF NOT EXISTS idx_pesquisas_satisfacao_telefone ON public.pesquisas_satisfacao(telefone);
CREATE INDEX IF NOT EXISTS idx_pesquisas_satisfacao_corretor ON public.pesquisas_satisfacao(corretor_id);

-- GRANTs (RLS abaixo)
GRANT SELECT ON public.pesquisas_satisfacao TO authenticated;
GRANT ALL ON public.pesquisas_satisfacao TO service_role;

ALTER TABLE public.pesquisas_satisfacao ENABLE ROW LEVEL SECURITY;

-- Policies de leitura
DROP POLICY IF EXISTS "satisfacao_select_admin" ON public.pesquisas_satisfacao;
CREATE POLICY "satisfacao_select_admin" ON public.pesquisas_satisfacao
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR corretor_id = auth.uid()
    OR (
      public.current_user_is_executivo()
      AND corretor_id IN (
        SELECT id FROM public.profiles WHERE responsavel_id = public.current_user_executivo_id()
      )
    )
  );

-- Updated_at
DROP TRIGGER IF EXISTS trg_pesquisas_satisfacao_updated ON public.pesquisas_satisfacao;
CREATE TRIGGER trg_pesquisas_satisfacao_updated
  BEFORE UPDATE ON public.pesquisas_satisfacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: criar pesquisa pendente quando vendas_leads vai para 'fechado'
CREATE OR REPLACE FUNCTION public.criar_pesquisa_satisfacao_on_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tel text;
BEGIN
  IF NEW.etapa = 'fechado'::public.vendas_etapa
     AND (TG_OP = 'INSERT' OR OLD.etapa IS DISTINCT FROM 'fechado'::public.vendas_etapa) THEN
    _tel := public.normalize_telefone(NEW.telefone);
    IF _tel IS NOT NULL AND length(_tel) >= 10 THEN
      -- evita duplicar se já existe pesquisa para este lead
      IF NOT EXISTS (SELECT 1 FROM public.pesquisas_satisfacao WHERE lead_id = NEW.id) THEN
        INSERT INTO public.pesquisas_satisfacao (lead_id, corretor_id, telefone, status)
        VALUES (NEW.id, NEW.corretor_id, _tel, 'pendente');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_leads_satisfacao ON public.vendas_leads;
CREATE TRIGGER trg_vendas_leads_satisfacao
  AFTER INSERT OR UPDATE OF etapa ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.criar_pesquisa_satisfacao_on_fechado();

-- Registrar resposta vinda do webhook do Z-API
CREATE OR REPLACE FUNCTION public.registrar_resposta_satisfacao(_telefone text, _mensagem text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tel text := public.normalize_telefone(_telefone);
  _nota smallint;
  _match text;
  _pesquisa public.pesquisas_satisfacao;
BEGIN
  IF _tel IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'telefone_invalido'); END IF;

  -- pega a pesquisa mais recente enviada para este telefone, ainda dentro da janela e sem nota
  SELECT * INTO _pesquisa
  FROM public.pesquisas_satisfacao
  WHERE telefone = _tel
    AND status = 'enviada'
    AND nota IS NULL
    AND (expira_em IS NULL OR expira_em > now())
  ORDER BY enviada_em DESC NULLS LAST
  LIMIT 1;

  IF _pesquisa.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_pesquisa_pendente');
  END IF;

  -- extrai primeiro dígito 1-5 da mensagem
  SELECT (regexp_match(COALESCE(_mensagem, ''), '([1-5])'))[1] INTO _match;
  IF _match IS NOT NULL THEN
    _nota := _match::smallint;
    UPDATE public.pesquisas_satisfacao
       SET nota = _nota,
           comentario = NULLIF(trim(_mensagem), ''),
           status = 'respondida',
           respondida_em = now()
     WHERE id = _pesquisa.id;
    RETURN jsonb_build_object('ok', true, 'pesquisa_id', _pesquisa.id, 'nota', _nota);
  ELSE
    -- mensagem sem nota válida — guarda como comentário mas não fecha (pode haver outra mensagem)
    UPDATE public.pesquisas_satisfacao
       SET comentario = COALESCE(comentario || E'\n', '') || COALESCE(_mensagem, '')
     WHERE id = _pesquisa.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'nota_nao_encontrada', 'pesquisa_id', _pesquisa.id);
  END IF;
END;
$$;

-- Marca expiradas como sem_resposta_valida
CREATE OR REPLACE FUNCTION public.expirar_pesquisas_satisfacao()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count int;
BEGIN
  UPDATE public.pesquisas_satisfacao
     SET status = 'sem_resposta_valida'
   WHERE status = 'enviada'
     AND nota IS NULL
     AND expira_em IS NOT NULL
     AND expira_em < now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Stats agregadas (Admin vê tudo, Executivo equipe, corretor próprio)
CREATE OR REPLACE FUNCTION public.get_satisfacao_stats(_from timestamptz, _to timestamptz)
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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _is_admin := public.has_role(_uid, 'admin'::public.app_role);
  _is_exec := public.current_user_is_executivo();
  _exec_id := public.current_user_executivo_id();

  IF _is_admin THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE ativo = true;
  ELSIF _is_exec AND _exec_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _allowed FROM profiles WHERE responsavel_id = _exec_id AND ativo = true;
    _allowed := COALESCE(_allowed, ARRAY[]::uuid[]) || _uid;
  ELSE
    _allowed := ARRAY[_uid];
  END IF;

  _allowed := COALESCE(_allowed, ARRAY[]::uuid[]);

  WITH base AS (
    SELECT ps.*, vl.nome AS lead_nome, p.nome AS corretor_nome
    FROM public.pesquisas_satisfacao ps
    JOIN public.vendas_leads vl ON vl.id = ps.lead_id
    LEFT JOIN public.profiles p ON p.id = ps.corretor_id
    WHERE ps.created_at >= _from AND ps.created_at <= _to
      AND ps.corretor_id = ANY(_allowed)
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', _from, 'to', _to),
    'escopo', jsonb_build_object('is_admin', _is_admin, 'is_exec', _is_exec, 'usuarios', COALESCE(array_length(_allowed,1),0)),
    'totais', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM base),
      'pendentes', (SELECT COUNT(*) FROM base WHERE status = 'pendente'),
      'enviadas', (SELECT COUNT(*) FROM base WHERE status = 'enviada'),
      'respondidas', (SELECT COUNT(*) FROM base WHERE status = 'respondida'),
      'sem_resposta', (SELECT COUNT(*) FROM base WHERE status = 'sem_resposta_valida'),
      'falhas', (SELECT COUNT(*) FROM base WHERE status = 'falha_envio')
    ),
    'nota_media', (SELECT round(AVG(nota)::numeric, 2) FROM base WHERE nota IS NOT NULL),
    'distribuicao', (
      SELECT COALESCE(jsonb_object_agg(n::text, qtd), '{}'::jsonb) FROM (
        SELECT n, COALESCE(COUNT(b.id), 0) AS qtd
        FROM generate_series(1, 5) n
        LEFT JOIN base b ON b.nota = n
        GROUP BY n
      ) d
    ),
    'taxa_resposta', (
      SELECT CASE WHEN COUNT(*) FILTER (WHERE status IN ('respondida','sem_resposta_valida')) > 0
        THEN round((COUNT(*) FILTER (WHERE status = 'respondida')::numeric
          / COUNT(*) FILTER (WHERE status IN ('respondida','sem_resposta_valida'))) * 100, 1)
        ELSE NULL END
      FROM base
    ),
    'respostas', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'lead_id', lead_id, 'lead_nome', lead_nome,
        'corretor_nome', corretor_nome, 'nota', nota,
        'comentario', comentario, 'respondida_em', respondida_em
      ) ORDER BY respondida_em DESC), '[]'::jsonb) FROM base WHERE status = 'respondida')
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_resposta_satisfacao(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expirar_pesquisas_satisfacao() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_satisfacao_stats(timestamptz, timestamptz) TO authenticated;

-- Backfill: cria pesquisas pendentes para vendas já fechadas que ainda não têm
INSERT INTO public.pesquisas_satisfacao (lead_id, corretor_id, telefone, status)
SELECT vl.id, vl.corretor_id, public.normalize_telefone(vl.telefone), 'pendente'
FROM public.vendas_leads vl
WHERE vl.etapa = 'fechado'::public.vendas_etapa
  AND public.normalize_telefone(vl.telefone) IS NOT NULL
  AND length(public.normalize_telefone(vl.telefone)) >= 10
  AND NOT EXISTS (SELECT 1 FROM public.pesquisas_satisfacao ps WHERE ps.lead_id = vl.id);
