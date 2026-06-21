
-- 1) Nova flag de elegibilidade ao Plantão por usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plantao_elegivel boolean NOT NULL DEFAULT false;

-- 2) Marca os 6 plantonistas atuais como elegíveis
UPDATE public.profiles
  SET plantao_elegivel = true
WHERE id IN (
  '586beadd-9d53-4909-be8e-858180a3beaa', -- Larissa Ferreira
  '5766e18d-f5bd-44d2-b46e-f6d0926180ea', -- Iuri Rodrigues
  'b71c1035-45c1-4089-821f-b1385c97d55f', -- Denise
  '54e0d881-3be8-4f7f-8117-d626a2cd924a', -- Fabiola Duarte
  '2584681c-f372-4960-8c2d-156890653b6a', -- Robson Terra
  '8cbe8876-945f-46c7-ade7-fd7314f4f63a'  -- Renata Carnevale
);

-- 3) Atualiza a função de elegibilidade para considerar a flag plantao_elegivel
CREATE OR REPLACE FUNCTION public.is_corretor_vendas_ou_executivo(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _uid AND role::text IN ('corretor_vendas','corretor')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.responsaveis r ON r.id = p.responsavel_id AND r.ativo = true
        AND lower(split_part(trim(r.nome),' ',1)) = lower(split_part(trim(p.nome),' ',1))
      WHERE p.id = _uid AND COALESCE(p.ativo, true) = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _uid
        AND COALESCE(p.ativo, true) = true
        AND COALESCE(p.plantao_elegivel, false) = true
    );
$function$;
