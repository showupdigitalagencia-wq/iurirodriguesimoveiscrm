-- Policies para o bucket privado backups-sistema
CREATE POLICY "admin_read_backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups-sistema'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "admin_delete_backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups-sistema'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);