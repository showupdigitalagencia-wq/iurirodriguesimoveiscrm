
-- =========================================================
-- 1. Tabela candidatos
-- =========================================================
CREATE TYPE public.candidato_status AS ENUM ('pendente_revisao', 'arquivado');

CREATE TABLE public.candidatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  creci TEXT,
  regiao public.lead_regiao NOT NULL,
  rg_path TEXT,
  cpf_path TEXT,
  creci_path TEXT,
  comprovante_path TEXT,
  status public.candidato_status NOT NULL DEFAULT 'pendente_revisao',
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  drive_folder_id TEXT,
  arquivado_em TIMESTAMPTZ,
  arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidatos_status ON public.candidatos(status);
CREATE INDEX idx_candidatos_regiao ON public.candidatos(regiao);
CREATE INDEX idx_candidatos_lead ON public.candidatos(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidatos TO authenticated;
GRANT INSERT ON public.candidatos TO anon;
GRANT ALL ON public.candidatos TO service_role;

ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;

-- Admin e Administrativo gerenciam tudo
CREATE POLICY "admin_administrativo_manage_candidatos"
ON public.candidatos FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_administrativo(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_administrativo(auth.uid())
);

-- Submissão pública: insert via service_role (server function pública usa supabaseAdmin)
-- Não precisamos de policy anon adicional porque o insert público vai via server fn.

CREATE TRIGGER trg_candidatos_updated_at
BEFORE UPDATE ON public.candidatos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. Tabela regiao_responsavel
-- =========================================================
CREATE TABLE public.regiao_responsavel (
  regiao public.lead_regiao PRIMARY KEY,
  responsavel_id UUID NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regiao_responsavel TO authenticated;
GRANT ALL ON public.regiao_responsavel TO service_role;

ALTER TABLE public.regiao_responsavel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_authenticated_read_regiao_responsavel"
ON public.regiao_responsavel FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin_manage_regiao_responsavel"
ON public.regiao_responsavel FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_regiao_responsavel_updated_at
BEFORE UPDATE ON public.regiao_responsavel
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial
INSERT INTO public.regiao_responsavel (regiao, responsavel_id) VALUES
  ('barra_da_tijuca', 'b1735a5d-3951-4d8a-aeec-b7cb3cc3a3d8'),
  ('recreio',        '6da316b4-5f28-4c17-b371-f4d03a276e0b'),
  ('belford_roxo',   '602a978b-846c-4c8e-bdd3-243d2ef921aa'),
  ('nilopolis',      '1a3bb6d1-8c06-4508-a851-8f470dc62448'),
  ('mesquita',       '1a3bb6d1-8c06-4508-a851-8f470dc62448')
ON CONFLICT (regiao) DO NOTHING;

-- =========================================================
-- 3. Configuração VSL URL
-- =========================================================
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('vsl_youtube_url', '""'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Permite Admin e Administrativo leitura de configuracoes (já existe policy admin manage)
CREATE POLICY "administrativo_read_configuracoes"
ON public.configuracoes FOR SELECT TO authenticated
USING (public.is_administrativo(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Permite leitura PÚBLICA da chave vsl_youtube_url (a LP /ingresso é pública)
GRANT SELECT ON public.configuracoes TO anon;
CREATE POLICY "public_read_vsl_url"
ON public.configuracoes FOR SELECT TO anon
USING (chave = 'vsl_youtube_url');

-- =========================================================
-- 4. Storage policies para bucket candidatos-docs
-- =========================================================
-- Admin e Administrativo podem ler/baixar
CREATE POLICY "admin_administrativo_read_candidatos_docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'candidatos-docs'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_administrativo(auth.uid())
  )
);

CREATE POLICY "admin_administrativo_delete_candidatos_docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'candidatos-docs'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_administrativo(auth.uid())
  )
);

-- Insert vai via service_role (supabaseAdmin) na server fn pública, não precisa policy anon.
