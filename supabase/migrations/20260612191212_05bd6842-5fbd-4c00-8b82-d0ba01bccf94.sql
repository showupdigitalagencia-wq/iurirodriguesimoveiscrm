DROP POLICY IF EXISTS auth_manage_config ON public.configuracoes;
CREATE POLICY admin_manage_configuracoes
ON public.configuracoes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS auth_manage_meta_mapping ON public.meta_form_mapping;
CREATE POLICY admin_manage_meta_form_mapping
ON public.meta_form_mapping
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS authenticated_manage_responsaveis ON public.responsaveis;
CREATE POLICY admin_manage_responsaveis
ON public.responsaveis
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS auth_read_historico ON public.lead_historico;
CREATE POLICY admin_or_owner_read_historico
ON public.lead_historico
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_historico.lead_id
      AND l.responsavel_id = public.current_user_responsavel_id()
  )
);