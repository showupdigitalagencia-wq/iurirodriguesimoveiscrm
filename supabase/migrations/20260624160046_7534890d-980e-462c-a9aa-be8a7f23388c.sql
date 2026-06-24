DROP POLICY IF EXISTS "Corretor gerencia suas visitas" ON public.vendas_visitas;

CREATE POLICY "Visitas: corretor, exec do time e admin"
ON public.vendas_visitas
FOR ALL
TO authenticated
USING (
  corretor_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vendas_visitas.corretor_id
      AND p.responsavel_id = auth.uid()
  )
)
WITH CHECK (
  corretor_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vendas_visitas.corretor_id
      AND p.responsavel_id = auth.uid()
  )
);