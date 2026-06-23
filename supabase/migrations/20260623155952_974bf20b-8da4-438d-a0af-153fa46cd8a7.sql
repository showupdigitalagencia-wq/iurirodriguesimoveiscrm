INSERT INTO public.configuracoes (chave, valor)
VALUES ('sophia_chaves_acoes', 'true'::jsonb)
ON CONFLICT (chave) DO NOTHING;