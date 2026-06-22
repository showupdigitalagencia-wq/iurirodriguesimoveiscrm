
-- Função que liga um profile ao executivo que recrutou o corretor na Captação
CREATE OR REPLACE FUNCTION public.link_corretor_to_executivo(_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _exec_id uuid;
  _current_exec uuid;
BEGIN
  -- E-mail do usuário (auth)
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _profile_id;
  IF _email IS NULL OR length(_email) = 0 THEN RETURN NULL; END IF;

  -- Executivo que fechou esse corretor na Captação (mais recente)
  SELECT l.responsavel_id INTO _exec_id
  FROM public.leads l
  WHERE l.is_corretor = true
    AND l.etapa = 'fechado'::public.lead_etapa
    AND l.responsavel_id IS NOT NULL
    AND lower(l.email) = _email
  ORDER BY l.fechado_em DESC NULLS LAST, l.updated_at DESC
  LIMIT 1;

  IF _exec_id IS NULL THEN RETURN NULL; END IF;

  SELECT responsavel_id INTO _current_exec FROM public.profiles WHERE id = _profile_id;
  IF _current_exec IS DISTINCT FROM _exec_id THEN
    UPDATE public.profiles SET responsavel_id = _exec_id, updated_at = now() WHERE id = _profile_id;
  END IF;

  RETURN _exec_id;
END;
$$;

-- Trigger A: novo profile -> tenta vincular
CREATE OR REPLACE FUNCTION public.trg_profiles_autolink_exec()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.link_corretor_to_executivo(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_autolink_exec ON public.profiles;
CREATE TRIGGER profiles_autolink_exec
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_autolink_exec();

-- Trigger B: lead da Captação vira 'fechado' como corretor -> vincula profile existente (se houver)
CREATE OR REPLACE FUNCTION public.trg_leads_autolink_profile_on_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _profile_id uuid;
BEGIN
  IF NEW.is_corretor = true
     AND NEW.etapa = 'fechado'::public.lead_etapa
     AND NEW.responsavel_id IS NOT NULL
     AND NEW.email IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.etapa IS DISTINCT FROM NEW.etapa
          OR OLD.is_corretor IS DISTINCT FROM NEW.is_corretor
          OR OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id
          OR OLD.email IS DISTINCT FROM NEW.email) THEN
    SELECT u.id INTO _profile_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(u.email) = lower(NEW.email)
    LIMIT 1;

    IF _profile_id IS NOT NULL THEN
      PERFORM public.link_corretor_to_executivo(_profile_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_autolink_profile_on_fechado ON public.leads;
CREATE TRIGGER leads_autolink_profile_on_fechado
AFTER INSERT OR UPDATE OF etapa, is_corretor, responsavel_id, email ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_leads_autolink_profile_on_fechado();

-- Backfill retroativo: roda a função para todos os profiles ativos
DO $$
DECLARE _p uuid;
BEGIN
  FOR _p IN SELECT id FROM public.profiles WHERE ativo = true LOOP
    PERFORM public.link_corretor_to_executivo(_p);
  END LOOP;
END $$;
