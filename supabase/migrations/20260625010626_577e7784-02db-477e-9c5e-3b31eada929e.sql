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

  -- Admin sempre vê tudo
  IF public.has_role(_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  -- Reuniões INDIVIDUAIS: visíveis SOMENTE para o criador (e admin acima).
  -- Não vazam para executivos por região/equipe, nem para corretores via lead.
  IF _tipo = 'individual'::public.reuniao_tipo THEN
    RETURN (_criado_por = _uid);
  END IF;

  -- Demais tipos: regras anteriores
  IF public.current_user_is_executivo() THEN
    _exec_id := public.current_user_executivo_id();

    IF _tipo IN ('institucional'::public.reuniao_tipo, 'mentoria'::public.reuniao_tipo) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- Corretor comum: só vê tipos não-individuais onde foi atribuído como participante
  RETURN EXISTS (
    SELECT 1
    FROM public.reuniao_participantes rp
    WHERE rp.reuniao_id = _reuniao_id
      AND rp.user_id = _uid
  );
END;
$function$;