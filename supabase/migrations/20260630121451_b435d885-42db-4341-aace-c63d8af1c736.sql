
-- 1) Permitir que qualquer membro autenticado leia imóveis (necessário pra
--    modal de portfolio em visitas/fechamento e widget de chaves em Hoje).
DROP POLICY IF EXISTS "Authenticated members read imoveis" ON public.imoveis;
CREATE POLICY "Authenticated members read imoveis"
ON public.imoveis FOR SELECT
TO authenticated
USING (true);

-- 2) Executivos enxergam os vendas_leads da equipe (corretores cujo
--    profiles.responsavel_id = executivo do user atual).
DROP POLICY IF EXISTS "Exec vê leads da equipe" ON public.vendas_leads;
CREATE POLICY "Exec vê leads da equipe"
ON public.vendas_leads FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vendas_leads.corretor_id
      AND p.responsavel_id = public.current_user_responsavel_id()
      AND public.current_user_is_executivo()
  )
);

DROP POLICY IF EXISTS "Exec atualiza leads da equipe" ON public.vendas_leads;
CREATE POLICY "Exec atualiza leads da equipe"
ON public.vendas_leads FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vendas_leads.corretor_id
      AND p.responsavel_id = public.current_user_responsavel_id()
      AND public.current_user_is_executivo()
  )
);
