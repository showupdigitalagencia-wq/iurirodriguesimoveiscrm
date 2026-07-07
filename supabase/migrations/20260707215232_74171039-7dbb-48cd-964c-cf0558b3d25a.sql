
-- Corrige e amplia visibilidade do Executivo sobre vendas_leads.
-- Regra: exec enxerga (a) leads atribuídos a corretores da sua equipe
--        (b) leads sem corretor da sua região (via regiao_responsavel)
--        (c) leads que ele próprio atribuiu (atribuido_por = auth.uid())
-- Também pode atualizar todos esses leads (reatribuir, mudar etapa, notas).

DROP POLICY IF EXISTS "Exec vê leads da equipe" ON public.vendas_leads;
DROP POLICY IF EXISTS "Exec atualiza leads da equipe" ON public.vendas_leads;

CREATE POLICY "Exec vê leads da equipe"
ON public.vendas_leads
FOR SELECT
USING (
  public.current_user_is_executivo()
  AND (
    -- leads atribuídos a corretores da equipe do executivo
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = vendas_leads.corretor_id
        AND p.responsavel_id = public.current_user_executivo_id()
    )
    -- leads sem corretor, mas na região do executivo
    OR (
      vendas_leads.corretor_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.regiao_responsavel rr
        WHERE rr.regiao = vendas_leads.regiao
          AND rr.responsavel_id = public.current_user_executivo_id()
      )
    )
    -- leads que o próprio executivo atribuiu (rastreio)
    OR vendas_leads.atribuido_por = auth.uid()
  )
);

CREATE POLICY "Exec atualiza leads da equipe"
ON public.vendas_leads
FOR UPDATE
USING (
  public.current_user_is_executivo()
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = vendas_leads.corretor_id
        AND p.responsavel_id = public.current_user_executivo_id()
    )
    OR (
      vendas_leads.corretor_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.regiao_responsavel rr
        WHERE rr.regiao = vendas_leads.regiao
          AND rr.responsavel_id = public.current_user_executivo_id()
      )
    )
    OR vendas_leads.atribuido_por = auth.uid()
  )
);

-- Espelha a mesma visibilidade no histórico dos leads
DROP POLICY IF EXISTS "Exec vê historico leads equipe" ON public.vendas_lead_historico;
CREATE POLICY "Exec vê historico leads equipe"
ON public.vendas_lead_historico
FOR SELECT
USING (
  public.current_user_is_executivo()
  AND EXISTS (
    SELECT 1 FROM public.vendas_leads vl
    WHERE vl.id = vendas_lead_historico.lead_id
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = vl.corretor_id
            AND p.responsavel_id = public.current_user_executivo_id()
        )
        OR (
          vl.corretor_id IS NULL AND EXISTS (
            SELECT 1 FROM public.regiao_responsavel rr
            WHERE rr.regiao = vl.regiao
              AND rr.responsavel_id = public.current_user_executivo_id()
          )
        )
        OR vl.atribuido_por = auth.uid()
      )
  )
);

-- Espelha visibilidade em vendas_visitas (agenda/visitas dos corretores da equipe)
DROP POLICY IF EXISTS "Exec vê visitas equipe" ON public.vendas_visitas;
CREATE POLICY "Exec vê visitas equipe"
ON public.vendas_visitas
FOR SELECT
USING (
  public.current_user_is_executivo()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vendas_visitas.corretor_id
      AND p.responsavel_id = public.current_user_executivo_id()
  )
);
