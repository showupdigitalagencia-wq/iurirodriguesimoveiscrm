-- 1) View imoveis_portfolio passa a usar security_invoker (respeita RLS do usuário)
ALTER VIEW public.imoveis_portfolio SET (security_invoker = on);

-- 2) Restringir colunas sensíveis em public.responsaveis
-- Mantém SELECT geral de colunas não sensíveis para authenticated e anon (necessário para UI)
-- mas revoga acesso a whatsapp e onesignal_external_id, que ficam apenas para service_role.
REVOKE SELECT (whatsapp, onesignal_external_id) ON public.responsaveis FROM authenticated;
REVOKE SELECT (whatsapp, onesignal_external_id) ON public.responsaveis FROM anon;
REVOKE UPDATE (whatsapp, onesignal_external_id) ON public.responsaveis FROM authenticated;
REVOKE UPDATE (whatsapp, onesignal_external_id) ON public.responsaveis FROM anon;
-- service_role permanece com ALL (mantido pelo grant existente).
