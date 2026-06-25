-- O REVOKE de coluna anterior não surtiu efeito porque o role authenticated tem
-- SELECT no nível da tabela. A maneira correta no Postgres é remover o SELECT
-- de tabela e reconceder apenas nas colunas seguras.
REVOKE SELECT ON public.responsaveis FROM authenticated;
GRANT SELECT (
  id, nome, canal, ativo, regiao, avatar_url, user_id, created_at, updated_at
) ON public.responsaveis TO authenticated;
