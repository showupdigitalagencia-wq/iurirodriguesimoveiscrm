
CREATE TABLE IF NOT EXISTS public.metas_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ano smallint NOT NULL CHECK (ano BETWEEN 2024 AND 2100),
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_vendas int NOT NULL DEFAULT 0 CHECK (meta_vendas >= 0),
  meta_locacoes int NOT NULL DEFAULT 0 CHECK (meta_locacoes >= 0),
  meta_receita numeric(12,2) NOT NULL DEFAULT 0 CHECK (meta_receita >= 0),
  meta_leads_atendidos int NOT NULL DEFAULT 0 CHECK (meta_leads_atendidos >= 0),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (corretor_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_mensais_periodo ON public.metas_mensais(ano, mes);
CREATE INDEX IF NOT EXISTS idx_metas_mensais_corretor ON public.metas_mensais(corretor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_mensais TO authenticated;
GRANT ALL ON public.metas_mensais TO service_role;

ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

-- Leitura: admin tudo; executivo a equipe; corretor o próprio.
DROP POLICY IF EXISTS "metas_select" ON public.metas_mensais;
CREATE POLICY "metas_select" ON public.metas_mensais
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR corretor_id = auth.uid()
    OR (
      public.current_user_is_executivo()
      AND corretor_id IN (SELECT id FROM public.profiles WHERE responsavel_id = public.current_user_executivo_id())
    )
  );

-- Insert: admin ou executivo da equipe do corretor alvo.
DROP POLICY IF EXISTS "metas_insert" ON public.metas_mensais;
CREATE POLICY "metas_insert" ON public.metas_mensais
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        public.current_user_is_executivo()
        AND corretor_id IN (SELECT id FROM public.profiles WHERE responsavel_id = public.current_user_executivo_id())
      )
    )
    -- não permite criar para meses passados
    AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM now())::int * 100 + EXTRACT(MONTH FROM now())::int)
  );

-- Update: idem; bloqueia editar mês passado.
DROP POLICY IF EXISTS "metas_update" ON public.metas_mensais;
CREATE POLICY "metas_update" ON public.metas_mensais
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.current_user_is_executivo()
      AND corretor_id IN (SELECT id FROM public.profiles WHERE responsavel_id = public.current_user_executivo_id())
    )
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        public.current_user_is_executivo()
        AND corretor_id IN (SELECT id FROM public.profiles WHERE responsavel_id = public.current_user_executivo_id())
      )
    )
    AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM now())::int * 100 + EXTRACT(MONTH FROM now())::int)
  );

-- Delete: só admin.
DROP POLICY IF EXISTS "metas_delete" ON public.metas_mensais;
CREATE POLICY "metas_delete" ON public.metas_mensais
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_metas_mensais_updated ON public.metas_mensais;
CREATE TRIGGER trg_metas_mensais_updated
  BEFORE UPDATE ON public.metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Progresso da meta de um corretor para (ano, mes)
CREATE OR REPLACE FUNCTION public.get_meta_progresso(_corretor_id uuid, _ano int, _mes int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _can boolean;
  _from timestamptz;
  _to timestamptz;
  _meta record;
  _real record;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  _can := public.has_role(_uid, 'admin'::public.app_role)
    OR _corretor_id = _uid
    OR (
      public.current_user_is_executivo()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _corretor_id AND responsavel_id = public.current_user_executivo_id())
    );
  IF NOT _can THEN RAISE EXCEPTION 'forbidden'; END IF;

  _from := make_timestamptz(_ano, _mes, 1, 0, 0, 0);
  _to := _from + interval '1 month';

  SELECT meta_vendas, meta_locacoes, meta_receita, meta_leads_atendidos
    INTO _meta
  FROM public.metas_mensais
  WHERE corretor_id = _corretor_id AND ano = _ano AND mes = _mes;

  SELECT
    COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'compra') AS vendas,
    COUNT(*) FILTER (WHERE etapa = 'fechado' AND tipo = 'locacao') AS locacoes,
    COALESCE(SUM(valor) FILTER (WHERE etapa = 'fechado'), 0) AS receita,
    COUNT(*) FILTER (WHERE atribuicao_status = 'aceito') AS leads_atendidos
    INTO _real
  FROM public.vendas_leads
  WHERE corretor_id = _corretor_id
    AND created_at >= _from AND created_at < _to;

  _result := jsonb_build_object(
    'corretor_id', _corretor_id,
    'ano', _ano, 'mes', _mes,
    'meta', jsonb_build_object(
      'vendas', COALESCE(_meta.meta_vendas, 0),
      'locacoes', COALESCE(_meta.meta_locacoes, 0),
      'receita', COALESCE(_meta.meta_receita, 0),
      'leads_atendidos', COALESCE(_meta.meta_leads_atendidos, 0),
      'definida', _meta.meta_vendas IS NOT NULL
    ),
    'realizado', jsonb_build_object(
      'vendas', _real.vendas,
      'locacoes', _real.locacoes,
      'receita', _real.receita,
      'leads_atendidos', _real.leads_atendidos
    )
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meta_progresso(uuid, int, int) TO authenticated;

-- Lista todas as metas + progresso para (ano, mes) — admin tudo, executivo equipe
CREATE OR REPLACE FUNCTION public.get_metas_progresso_lista(_ano int, _mes int)
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
  _from timestamptz;
  _to timestamptz;
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
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;
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

GRANT EXECUTE ON FUNCTION public.get_metas_progresso_lista(int, int) TO authenticated;
