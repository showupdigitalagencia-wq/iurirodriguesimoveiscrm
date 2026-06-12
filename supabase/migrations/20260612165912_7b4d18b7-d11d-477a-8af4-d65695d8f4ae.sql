CREATE TABLE public.meta_form_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  regiao lead_regiao NOT NULL,
  canal lead_canal NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_form_mapping TO authenticated;
GRANT ALL ON public.meta_form_mapping TO service_role;

ALTER TABLE public.meta_form_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_meta_mapping"
  ON public.meta_form_mapping FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_meta_form_mapping_updated_at
  BEFORE UPDATE ON public.meta_form_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();