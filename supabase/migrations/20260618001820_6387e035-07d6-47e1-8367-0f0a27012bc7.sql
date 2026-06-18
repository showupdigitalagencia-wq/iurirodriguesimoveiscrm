
CREATE OR REPLACE FUNCTION public.can_view_candidatos(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text = 'administrativo'
          AND lower(coalesce(p.nome, '')) LIKE '%larissa%'
      )
    )
$$;

DROP POLICY IF EXISTS "Admin/Administrativo can manage candidatos" ON public.candidatos;
DROP POLICY IF EXISTS "Administrativo e Admin podem ver candidatos" ON public.candidatos;
DROP POLICY IF EXISTS "candidatos_admin_admst_all" ON public.candidatos;

CREATE POLICY "candidatos_restrito_revisores"
ON public.candidatos
FOR ALL
TO authenticated
USING (public.can_view_candidatos(auth.uid()))
WITH CHECK (public.can_view_candidatos(auth.uid()));

DROP POLICY IF EXISTS "Admin/Administrativo can read candidatos-docs" ON storage.objects;
DROP POLICY IF EXISTS "Admin e Administrativo leem candidatos-docs" ON storage.objects;
DROP POLICY IF EXISTS "candidatos_docs_read" ON storage.objects;

CREATE POLICY "candidatos_docs_read_revisores"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'candidatos-docs'
  AND public.can_view_candidatos(auth.uid())
);
