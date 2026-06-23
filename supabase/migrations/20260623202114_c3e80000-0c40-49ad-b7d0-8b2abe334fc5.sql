CREATE TABLE public.mensagem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  escopo text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal','global')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagem_templates TO authenticated;
GRANT ALL ON public.mensagem_templates TO service_role;

ALTER TABLE public.mensagem_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_own_or_global" ON public.mensagem_templates
  FOR SELECT TO authenticated
  USING (escopo = 'global' OR owner_id = auth.uid());

CREATE POLICY "templates_insert_own" ON public.mensagem_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (escopo = 'pessoal' AND owner_id = auth.uid())
    OR (escopo = 'global' AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "templates_update_own_or_admin" ON public.mensagem_templates
  FOR UPDATE TO authenticated
  USING (
    (escopo = 'pessoal' AND owner_id = auth.uid())
    OR (escopo = 'global' AND public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    (escopo = 'pessoal' AND owner_id = auth.uid())
    OR (escopo = 'global' AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "templates_delete_own_or_admin" ON public.mensagem_templates
  FOR DELETE TO authenticated
  USING (
    (escopo = 'pessoal' AND owner_id = auth.uid())
    OR (escopo = 'global' AND public.has_role(auth.uid(), 'admin'))
  );

CREATE TRIGGER mensagem_templates_set_updated
  BEFORE UPDATE ON public.mensagem_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();