ALTER TYPE public.reuniao_tipo ADD VALUE IF NOT EXISTS 'mentoria';

CREATE OR REPLACE FUNCTION public.can_user_view_reuniao(_reuniao_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    IF _tipo IN ('institucional'::public.reuniao_tipo, 'mentoria'::public.reuniao_tipo) THEN
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
$function$;