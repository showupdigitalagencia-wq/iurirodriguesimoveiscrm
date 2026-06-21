
-- 1) NOTIFICACOES: restringir acesso a admins (service_role bypassa RLS)
DROP POLICY IF EXISTS auth_read_notif ON public.notificacoes;
DROP POLICY IF EXISTS auth_write_notif ON public.notificacoes;

CREATE POLICY admin_read_notif ON public.notificacoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY admin_write_notif ON public.notificacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) RESPONSAVEIS: remover leitura anônima pública
DROP POLICY IF EXISTS anyone_read_responsaveis ON public.responsaveis;

CREATE POLICY auth_read_responsaveis ON public.responsaveis
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.responsaveis FROM anon;

-- 3) REUNIAO_PARTICIPANTES: fechar escrita aberta
DROP POLICY IF EXISTS "Auth write participantes" ON public.reuniao_participantes;

CREATE POLICY participantes_insert ON public.reuniao_participantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.can_user_view_reuniao(reuniao_id)
  );

CREATE POLICY participantes_update ON public.reuniao_participantes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.can_user_view_reuniao(reuniao_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.can_user_view_reuniao(reuniao_id)
  );

CREATE POLICY participantes_delete ON public.reuniao_participantes
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.can_user_view_reuniao(reuniao_id)
  );

-- 4) REALTIME: exigir autenticação para se inscrever em canais
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_can_listen ON realtime.messages;
CREATE POLICY authenticated_can_listen ON realtime.messages
  FOR SELECT TO authenticated
  USING (true);

-- 5) CANDIDATOS: substituir checagem hardcoded de nome 'larissa' por role dedicada
-- Cria nova app_role 'candidatos_viewer' e migra Larissa para essa role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'candidatos_viewer'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'candidatos_viewer';
  END IF;
END$$;
