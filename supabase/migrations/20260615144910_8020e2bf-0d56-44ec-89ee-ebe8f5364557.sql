ALTER TABLE public.reuniao_participantes ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.reuniao_participantes ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false;
ALTER TABLE public.reunioes ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS reunioes_recorrente_slot_unique ON public.reunioes (data_inicio) WHERE recorrente = true;
DROP POLICY IF EXISTS "Auth users update reunioes" ON public.reunioes;
CREATE POLICY "Update reunioes scoped" ON public.reunioes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR (recorrente = false)
);
DROP POLICY IF EXISTS "Admin delete reunioes" ON public.reunioes;
CREATE POLICY "Delete reunioes scoped" ON public.reunioes FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);