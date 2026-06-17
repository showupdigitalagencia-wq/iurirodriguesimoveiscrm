
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS drive_folder_id text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS drive_folder_id text;

CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  nome text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  drive_file_id text NOT NULL,
  drive_web_view_link text,
  drive_web_content_link text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_target_chk CHECK (imovel_id IS NOT NULL OR contrato_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS documentos_imovel_idx ON public.documentos(imovel_id);
CREATE INDEX IF NOT EXISTS documentos_contrato_idx ON public.documentos(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e Administrativo gerenciam documentos"
  ON public.documentos
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_administrativo(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_administrativo(auth.uid())
  );

CREATE TRIGGER documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
