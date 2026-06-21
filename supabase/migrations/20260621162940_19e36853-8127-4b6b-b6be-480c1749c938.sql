CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  -- Apenas o primeiro usuário do sistema vira admin automaticamente.
  -- Novos cadastros NÃO recebem role por padrão: ficam sem acesso até
  -- que um admin atribua o perfil correto manualmente.
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;