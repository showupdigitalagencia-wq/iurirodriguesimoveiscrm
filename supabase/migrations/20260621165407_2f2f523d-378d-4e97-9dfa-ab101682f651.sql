
-- Storage policies for captacao-assets bucket
CREATE POLICY "captacao_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'captacao-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "captacao_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'captacao-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "captacao_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'captacao-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "captacao_authenticated_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'captacao-assets');

-- Seed default configuration keys
INSERT INTO public.configuracoes (chave, valor, updated_at) VALUES
  ('vsl_captacao_url', '""'::jsonb, now()),
  ('captacao_team_photos', '[]'::jsonb, now())
ON CONFLICT (chave) DO NOTHING;
