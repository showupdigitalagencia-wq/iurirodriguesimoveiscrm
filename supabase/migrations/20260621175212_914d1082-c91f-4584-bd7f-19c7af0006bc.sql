
REVOKE EXECUTE ON FUNCTION public.plantonista_do_dia(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_corretor_vendas_ou_executivo(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.plantonista_do_dia(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_corretor_vendas_ou_executivo(uuid) TO authenticated, service_role;
