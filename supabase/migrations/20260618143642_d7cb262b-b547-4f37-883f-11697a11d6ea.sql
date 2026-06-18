
CREATE POLICY "Authenticated can read imoveis-fotos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'imoveis-fotos');

CREATE POLICY "Authenticated can upload imoveis-fotos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'imoveis-fotos');

CREATE POLICY "Authenticated can update imoveis-fotos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'imoveis-fotos');

CREATE POLICY "Authenticated can delete imoveis-fotos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'imoveis-fotos');
