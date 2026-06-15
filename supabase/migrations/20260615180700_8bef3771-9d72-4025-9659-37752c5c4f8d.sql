CREATE OR REPLACE FUNCTION public.current_user_is_executivo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.responsaveis r
      ON r.id = p.responsavel_id
     AND r.ativo = true
     AND lower(split_part(trim(r.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
    WHERE p.id = auth.uid()
      AND COALESCE(p.ativo, true) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_executivo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.responsavel_id
  FROM public.profiles p
  JOIN public.responsaveis r
    ON r.id = p.responsavel_id
   AND r.ativo = true
   AND lower(split_part(trim(r.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
  WHERE p.id = auth.uid()
    AND COALESCE(p.ativo, true) = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_user_view_reuniao(_reuniao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tipo public.reuniao_tipo;
  _criado_por uuid;
  _exec_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT r.tipo, r.criado_por
    INTO _tipo, _criado_por
  FROM public.reunioes r
  WHERE r.id = _reuniao_id;

  IF _tipo IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF public.current_user_is_executivo() THEN
    _exec_id := public.current_user_executivo_id();

    IF _tipo = 'institucional'::public.reuniao_tipo THEN
      RETURN true;
    END IF;

    IF _tipo = 'individual'::public.reuniao_tipo THEN
      RETURN (
        _criado_por = _uid
        OR EXISTS (
          SELECT 1
          FROM public.reuniao_participantes rp
          WHERE rp.reuniao_id = _reuniao_id
            AND (rp.user_id = _uid OR rp.added_by = _uid OR rp.responsavel_id = _exec_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.reuniao_participantes rp
          JOIN public.leads l ON l.id = rp.lead_id
          WHERE rp.reuniao_id = _reuniao_id
            AND l.responsavel_id = _exec_id
        )
      );
    END IF;

    RETURN false;
  END IF;

  RETURN (
    _tipo = 'individual'::public.reuniao_tipo
    AND (
      _criado_por = _uid
      OR EXISTS (
        SELECT 1
        FROM public.reuniao_participantes rp
        WHERE rp.reuniao_id = _reuniao_id
          AND rp.user_id = _uid
      )
      OR EXISTS (
        SELECT 1
        FROM public.reuniao_participantes rp
        JOIN public.vendas_leads vl ON vl.id = rp.lead_id
        WHERE rp.reuniao_id = _reuniao_id
          AND vl.corretor_id = _uid
      )
    )
  );
END;
$$;

DROP POLICY IF EXISTS "Admin e executivos veem todas as reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Corretor ve apenas reunioes proprias" ON public.reunioes;
DROP POLICY IF EXISTS "Bloquear institucional e alinhamento para corretor" ON public.reunioes;
DROP POLICY IF EXISTS "Reunioes visiveis por perfil" ON public.reunioes;

CREATE POLICY "Reunioes visiveis por perfil"
ON public.reunioes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.can_user_view_reuniao(id));

DROP POLICY IF EXISTS "Read participantes scoped" ON public.reuniao_participantes;
CREATE POLICY "Read participantes scoped"
ON public.reuniao_participantes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.can_user_view_reuniao(reuniao_id));

DROP POLICY IF EXISTS "Delete reunioes scoped" ON public.reunioes;
DROP POLICY IF EXISTS "Bloquear exclusao de reunioes pelo app" ON public.reunioes;
CREATE POLICY "Bloquear exclusao de reunioes pelo app"
ON public.reunioes
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (false);