
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS chave_com_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chave_retirada_em timestamptz,
  ADD COLUMN IF NOT EXISTS chave_foto_atual text;

CREATE INDEX IF NOT EXISTS idx_imoveis_chave_com ON public.imoveis(chave_com_id);

CREATE TABLE IF NOT EXISTS public.chaves_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('retirada','devolucao')),
  foto_url text NOT NULL,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chaves_log_imovel ON public.chaves_log(imovel_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_chaves_log_corretor ON public.chaves_log(corretor_id, criado_em DESC);

GRANT SELECT, INSERT ON public.chaves_log TO authenticated;
GRANT ALL ON public.chaves_log TO service_role;

ALTER TABLE public.chaves_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chaves_log_select_authenticated" ON public.chaves_log;
CREATE POLICY "chaves_log_select_authenticated"
  ON public.chaves_log FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chaves_log_insert_self_or_admin" ON public.chaves_log;
CREATE POLICY "chaves_log_insert_self_or_admin"
  ON public.chaves_log FOR INSERT TO authenticated
  WITH CHECK (
    corretor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chaves_log;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.imoveis;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.chaves_log REPLICA IDENTITY FULL;

INSERT INTO public.configuracoes (chave, valor)
VALUES ('chaves_atraso_horas', '24'::jsonb)
ON CONFLICT (chave) DO NOTHING;

DROP POLICY IF EXISTS "chaves_fotos_select_authenticated" ON storage.objects;
CREATE POLICY "chaves_fotos_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chaves-fotos');

DROP POLICY IF EXISTS "chaves_fotos_insert_authenticated" ON storage.objects;
CREATE POLICY "chaves_fotos_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chaves-fotos');

CREATE OR REPLACE FUNCTION public.retirar_chave(_imovel_id uuid, _foto_url text, _observacao text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _atual uuid;
  _log_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _foto_url IS NULL OR length(trim(_foto_url)) = 0 THEN
    RAISE EXCEPTION 'foto obrigatoria';
  END IF;

  SELECT chave_com_id INTO _atual FROM public.imoveis WHERE id = _imovel_id FOR UPDATE;
  IF _atual IS NOT NULL THEN
    RAISE EXCEPTION 'chave ja esta com outro corretor';
  END IF;

  INSERT INTO public.chaves_log (imovel_id, corretor_id, tipo, foto_url, observacao)
  VALUES (_imovel_id, _uid, 'retirada', _foto_url, _observacao)
  RETURNING id INTO _log_id;

  UPDATE public.imoveis
  SET chave_com_id = _uid,
      chave_retirada_em = now(),
      chave_foto_atual = _foto_url,
      updated_at = now()
  WHERE id = _imovel_id;

  RETURN _log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.devolver_chave(_imovel_id uuid, _foto_url text, _observacao text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _atual uuid;
  _is_admin boolean;
  _log_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _foto_url IS NULL OR length(trim(_foto_url)) = 0 THEN
    RAISE EXCEPTION 'foto obrigatoria';
  END IF;

  _is_admin := public.has_role(_uid, 'admin'::public.app_role);

  SELECT chave_com_id INTO _atual FROM public.imoveis WHERE id = _imovel_id FOR UPDATE;
  IF _atual IS NULL THEN
    RAISE EXCEPTION 'chave ja esta disponivel';
  END IF;
  IF _atual <> _uid AND NOT _is_admin THEN
    RAISE EXCEPTION 'somente quem retirou (ou admin) pode devolver';
  END IF;

  INSERT INTO public.chaves_log (imovel_id, corretor_id, tipo, foto_url, observacao)
  VALUES (_imovel_id, _atual, 'devolucao', _foto_url, _observacao)
  RETURNING id INTO _log_id;

  UPDATE public.imoveis
  SET chave_com_id = NULL,
      chave_retirada_em = NULL,
      chave_foto_atual = NULL,
      updated_at = now()
  WHERE id = _imovel_id;

  RETURN _log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retirar_chave(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_chave(uuid, text, text) TO authenticated;
