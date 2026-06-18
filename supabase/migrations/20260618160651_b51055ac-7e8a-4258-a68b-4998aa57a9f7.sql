ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS locatario_nome text,
  ADD COLUMN IF NOT EXISTS locatario_documento text,
  ADD COLUMN IF NOT EXISTS locatario_telefone text,
  ADD COLUMN IF NOT EXISTS locatario_email text;