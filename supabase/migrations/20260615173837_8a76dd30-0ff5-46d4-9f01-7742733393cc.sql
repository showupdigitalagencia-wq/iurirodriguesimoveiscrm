
-- Identifica executivo via match de primeiro nome com a tabela responsaveis
CREATE OR REPLACE FUNCTION public.current_user_is_executivo()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.responsaveis r
      ON r.ativo = true
     AND lower(split_part(trim(r.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
    WHERE p.id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_executivo_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id
  FROM public.profiles p
  JOIN public.responsaveis r
    ON r.ativo = true
   AND lower(split_part(trim(r.nome), ' ', 1)) = lower(split_part(trim(p.nome), ' ', 1))
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_corretor_responsavel_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT responsavel_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Limpa policies anteriores que possam estar parciais
DROP POLICY IF EXISTS "Auth users read reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Admin e executivos veem todas as reunioes" ON public.reunioes;
DROP POLICY IF EXISTS "Corretor ve apenas reunioes proprias" ON public.reunioes;
DROP POLICY IF EXISTS "Bloquear institucional e alinhamento para corretor" ON public.reunioes;

-- Admin e executivos veem tudo
CREATE POLICY "Admin e executivos veem todas as reunioes"
ON public.reunioes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.current_user_is_executivo()
);

-- Corretor: apenas reuniões em que participa / criou / envolve seu lead / seu executivo
CREATE POLICY "Corretor ve apenas reunioes proprias"
ON public.reunioes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  criado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.reuniao_participantes p
    WHERE p.reuniao_id = reunioes.id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.reuniao_participantes p
    JOIN public.vendas_leads vl ON vl.id = p.lead_id
    WHERE p.reuniao_id = reunioes.id AND vl.corretor_id = auth.uid()
  )
  OR (
    public.current_corretor_responsavel_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.reuniao_participantes p
      WHERE p.reuniao_id = reunioes.id
        AND p.responsavel_id = public.current_corretor_responsavel_id()
    )
  )
);

-- RESTRICTIVE: bloqueia institucional/alinhamento para quem não é admin nem executivo
CREATE POLICY "Bloquear institucional e alinhamento para corretor"
ON public.reunioes AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.current_user_is_executivo()
  OR tipo NOT IN ('institucional', 'alinhamento')
);

-- Participantes: visibilidade segue a da reunião (RLS de reunioes filtra o EXISTS)
DROP POLICY IF EXISTS "Auth read participantes" ON public.reuniao_participantes;
DROP POLICY IF EXISTS "Read participantes scoped" ON public.reuniao_participantes;
CREATE POLICY "Read participantes scoped"
ON public.reuniao_participantes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.reunioes r WHERE r.id = reuniao_id)
);
