CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT ativo
    FROM public.profiles
    WHERE id = auth.uid()
  ), false)
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO service_role;

DROP POLICY IF EXISTS admin_or_owner_read_leads ON public.leads;
CREATE POLICY admin_or_owner_read_leads
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.current_user_is_active()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  )
);

DROP POLICY IF EXISTS admin_or_owner_update_leads ON public.leads;
CREATE POLICY admin_or_owner_update_leads
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.current_user_is_active()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  )
)
WITH CHECK (
  public.current_user_is_active()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  )
);

DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
CREATE POLICY admin_or_self_read_profiles
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

DROP POLICY IF EXISTS admin_or_owner_read_historico ON public.lead_historico;
CREATE POLICY admin_or_owner_read_historico
ON public.lead_historico
FOR SELECT
TO authenticated
USING (
  public.current_user_is_active()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_historico.lead_id
        AND l.responsavel_id = public.current_user_responsavel_id()
    )
  )
);

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_responsavel_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_responsavel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_responsavel_id() TO service_role;