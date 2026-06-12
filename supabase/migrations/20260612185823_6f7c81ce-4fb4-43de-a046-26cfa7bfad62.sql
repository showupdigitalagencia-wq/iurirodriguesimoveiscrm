ALTER TYPE public.lead_regiao ADD VALUE IF NOT EXISTS 'belford_roxo';
ALTER TYPE public.lead_regiao ADD VALUE IF NOT EXISTS 'nilopolis';
ALTER TYPE public.lead_regiao ADD VALUE IF NOT EXISTS 'mesquita';

CREATE OR REPLACE FUNCTION public.current_user_responsavel_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT responsavel_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS authenticated_read_leads ON public.leads;
DROP POLICY IF EXISTS authenticated_update_leads ON public.leads;
DROP POLICY IF EXISTS authenticated_delete_leads ON public.leads;

CREATE POLICY admin_or_owner_read_leads ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  );

CREATE POLICY admin_or_owner_update_leads ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR responsavel_id = public.current_user_responsavel_id()
  );

CREATE POLICY admin_delete_leads ON public.leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));