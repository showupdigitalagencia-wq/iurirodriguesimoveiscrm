
CREATE OR REPLACE FUNCTION public.corretor_ocupado_agora(_corretor_id uuid, _at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendas_visitas v
    WHERE v.corretor_id = _corretor_id
      AND v.data_inicio <= _at
      AND v.data_inicio + make_interval(mins => COALESCE(v.duracao_min, 60)) > _at
      AND COALESCE(v.status, 'agendada') NOT IN ('cancelada')
  )
  OR EXISTS (
    SELECT 1 FROM public.reuniao_participantes rp
    JOIN public.reunioes r ON r.id = rp.reuniao_id
    WHERE rp.user_id = _corretor_id
      AND r.data_inicio <= _at
      AND r.data_inicio + make_interval(mins => COALESCE(r.duracao_min, 60)) > _at
      AND COALESCE(r.status::text, 'agendada') NOT IN ('cancelada')
  );
$$;

GRANT EXECUTE ON FUNCTION public.corretor_ocupado_agora(uuid, timestamptz) TO authenticated, service_role;
