
-- =====================================================================
-- 1) Vínculo direto Executivo <-> usuário (sem comparar primeiro nome)
-- =====================================================================
ALTER TABLE public.responsaveis
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_responsaveis_user_id
  ON public.responsaveis(user_id) WHERE user_id IS NOT NULL;

-- Backfill: usa a regra antiga (primeiro nome) UMA ÚNICA VEZ para popular o vínculo
UPDATE public.responsaveis r
SET user_id = p.id
FROM public.profiles p
WHERE r.user_id IS NULL
  AND r.ativo = true
  AND COALESCE(p.ativo, true) = true
  AND lower(split_part(trim(r.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
  AND p.responsavel_id = r.id;

-- =====================================================================
-- 2) Reescreve funções para usar responsaveis.user_id (vínculo seguro)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_user_is_executivo()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.responsaveis r
    WHERE r.user_id = auth.uid() AND r.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_executivo_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.responsaveis
  WHERE user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_corretor_vendas_ou_executivo(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('corretor_vendas','corretor'))
    OR EXISTS (SELECT 1 FROM public.responsaveis WHERE user_id = _uid AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION public.get_metas_progresso_lista(_ano int, _mes int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
        WHERE r2.user_id = p.id AND r2.ativo = true
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

-- =====================================================================
-- 3) Storage: imoveis-fotos — restringe escrita por propriedade do imóvel
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can upload imoveis-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update imoveis-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete imoveis-fotos" ON storage.objects;

-- Helper: verifica se o usuário pode escrever fotos do imóvel no path informado
CREATE OR REPLACE FUNCTION public.can_write_imovel_foto(_name text, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _folder text;
  _imovel_id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(_uid, 'admin'::public.app_role) THEN RETURN true; END IF;

  _folder := split_part(_name, '/', 1);

  -- Pasta especial usada quando o imóvel ainda não foi criado:
  -- aceita escrita de qualquer autenticado (necessário para o cadastro novo).
  IF _folder = 'novo' THEN RETURN true; END IF;

  BEGIN
    _imovel_id := _folder::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.imoveis i
    WHERE i.id = _imovel_id AND i.captador_id = _uid
  );
END;
$$;

CREATE POLICY "imoveis_fotos_insert_owner_or_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imoveis-fotos' AND public.can_write_imovel_foto(name));

CREATE POLICY "imoveis_fotos_update_owner_or_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imoveis-fotos' AND public.can_write_imovel_foto(name))
  WITH CHECK (bucket_id = 'imoveis-fotos' AND public.can_write_imovel_foto(name));

CREATE POLICY "imoveis_fotos_delete_owner_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imoveis-fotos' AND public.can_write_imovel_foto(name));
