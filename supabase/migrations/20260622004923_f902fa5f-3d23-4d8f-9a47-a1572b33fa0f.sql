CREATE POLICY "authenticated_read_feature_flags"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (chave IN ('sistema_corretores_ativo', 'modulo_administrativo_ativo'));