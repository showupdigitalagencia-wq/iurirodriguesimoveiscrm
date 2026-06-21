
CREATE OR REPLACE FUNCTION public.can_view_candidatos(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'candidatos_viewer'::public.app_role)
    )
$function$;

-- Migrar usuários administrativos chamados Larissa (se houver) para a nova role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'candidatos_viewer'::public.app_role
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role::text = 'administrativo'
  AND lower(coalesce(p.nome, '')) LIKE '%larissa%'
ON CONFLICT (user_id, role) DO NOTHING;
