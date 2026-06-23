
-- Conquistas (badges)
CREATE TABLE public.conquistas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text NOT NULL,
  icone text NOT NULL,
  categoria text NOT NULL,
  meta_valor integer NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conquistas TO authenticated;
GRANT ALL ON public.conquistas TO service_role;
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_conquistas" ON public.conquistas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_conquistas" ON public.conquistas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.user_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conquista_id text NOT NULL REFERENCES public.conquistas(id) ON DELETE CASCADE,
  progresso integer NOT NULL DEFAULT 0,
  desbloqueada_em timestamptz,
  notificada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, conquista_id)
);
GRANT SELECT, INSERT, UPDATE ON public.user_conquistas TO authenticated;
GRANT ALL ON public.user_conquistas TO service_role;
ALTER TABLE public.user_conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_user_conquistas" ON public.user_conquistas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_manage_user_conquistas" ON public.user_conquistas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_user_conquistas_updated_at BEFORE UPDATE ON public.user_conquistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Catálogo inicial
INSERT INTO public.conquistas (id, nome, descricao, icone, categoria, meta_valor, ordem) VALUES
  ('primeira_venda',   'Primeira Venda',     'Feche sua primeira venda',                   '🏆', 'vendas',    1,  10),
  ('vendas_5',         '5 Vendas',           'Feche 5 vendas de compra',                   '🥈', 'vendas',    5,  20),
  ('vendas_10',        '10 Vendas',          'Feche 10 vendas de compra',                  '🥇', 'vendas',   10,  30),
  ('primeira_locacao', 'Primeira Locação',   'Feche sua primeira locação',                 '🔑', 'locacao',   1,  40),
  ('locacoes_5',       '5 Locações',         'Feche 5 locações',                           '🏘️', 'locacao',   5,  50),
  ('visitas_10',       'Visitante Ativo',    'Realize 10 visitas presenciais',             '🚗', 'atividade',10,  60),
  ('visitas_50',       'Estradeiro',         'Realize 50 visitas presenciais',             '🛣️', 'atividade',50,  70),
  ('resposta_rapida',  'Resposta Relâmpago', '10 leads respondidos em menos de 5 minutos', '⚡', 'atendimento',10,80),
  ('meta_batida',      'Meta Batida',        'Atinja sua meta de vendas em 1 mês',         '🎯', 'meta',      1,  90),
  ('meta_3x',          'Tricampeão',         'Atinja a meta de vendas em 3 meses',         '🏅', 'meta',      3, 100),
  ('recrutador_5',     'Recrutador',         'Recrute 5 corretores (Executivo)',           '🤝', 'captacao',  5, 110)
ON CONFLICT (id) DO NOTHING;

-- Recalcula conquistas para um usuário, retorna lista de novas desbloqueadas
CREATE OR REPLACE FUNCTION public.recalcular_conquistas_usuario(_user_id uuid)
RETURNS TABLE(conquista_id text, nome text, icone text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _vendas int;
  _locacoes int;
  _visitas int;
  _resp_rapida int;
  _exec_id uuid;
  _meses_meta int;
  _recrutas int;
  _now timestamptz := now();
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO _vendas FROM public.vendas_leads
    WHERE corretor_id = _user_id AND etapa = 'fechado'::vendas_etapa AND tipo = 'compra';
  SELECT COUNT(*) INTO _locacoes FROM public.vendas_leads
    WHERE corretor_id = _user_id AND etapa = 'fechado'::vendas_etapa AND tipo = 'locacao';
  SELECT COUNT(*) INTO _visitas FROM public.vendas_visitas
    WHERE corretor_id = _user_id AND comparecimento = 'realizada';
  SELECT COUNT(*) INTO _resp_rapida FROM public.vendas_leads
    WHERE corretor_id = _user_id
      AND first_response_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (first_response_at - created_at)) < 300;

  -- Meses em que bateu meta de vendas (compra)
  SELECT COUNT(*) INTO _meses_meta FROM (
    SELECT m.ano, m.mes, m.meta_vendas,
      (SELECT COUNT(*) FROM public.vendas_leads vl
        WHERE vl.corretor_id = _user_id
          AND vl.etapa = 'fechado'::vendas_etapa
          AND vl.tipo = 'compra'
          AND vl.fechado_em IS NOT NULL
          AND EXTRACT(YEAR FROM vl.fechado_em) = m.ano
          AND EXTRACT(MONTH FROM vl.fechado_em) = m.mes) AS realizadas
    FROM public.metas_mensais m
    WHERE m.corretor_id = _user_id AND m.meta_vendas > 0
  ) s WHERE s.realizadas >= s.meta_vendas;

  -- Recrutas (se o usuário é executivo): leads fechados na captação onde responsavel_id = exec do usuário
  SELECT public.current_user_executivo_id() INTO _exec_id;
  _recrutas := 0;
  IF _exec_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _recrutas FROM public.leads
      WHERE responsavel_id = _exec_id AND etapa = 'fechado'::lead_etapa AND is_corretor = true;
  END IF;

  -- Upsert progresso e desbloqueio
  RETURN QUERY
  WITH progresso(cid, val) AS (
    VALUES
      ('primeira_venda',   _vendas),
      ('vendas_5',         _vendas),
      ('vendas_10',        _vendas),
      ('primeira_locacao', _locacoes),
      ('locacoes_5',       _locacoes),
      ('visitas_10',       _visitas),
      ('visitas_50',       _visitas),
      ('resposta_rapida',  _resp_rapida),
      ('meta_batida',      _meses_meta),
      ('meta_3x',          _meses_meta),
      ('recrutador_5',     _recrutas)
  ),
  up AS (
    INSERT INTO public.user_conquistas (user_id, conquista_id, progresso, desbloqueada_em)
    SELECT _user_id, p.cid, p.val,
      CASE WHEN p.val >= c.meta_valor THEN _now ELSE NULL END
    FROM progresso p JOIN public.conquistas c ON c.id = p.cid
    ON CONFLICT (user_id, conquista_id) DO UPDATE
      SET progresso = EXCLUDED.progresso,
          desbloqueada_em = COALESCE(public.user_conquistas.desbloqueada_em, EXCLUDED.desbloqueada_em),
          updated_at = _now
    RETURNING user_conquistas.conquista_id, user_conquistas.desbloqueada_em,
              (xmax = 0) AS inserted,
              user_conquistas.notificada
  )
  SELECT up.conquista_id, c.nome, c.icone
  FROM up JOIN public.conquistas c ON c.id = up.conquista_id
  WHERE up.desbloqueada_em IS NOT NULL AND up.desbloqueada_em = _now;
END $$;

GRANT EXECUTE ON FUNCTION public.recalcular_conquistas_usuario(uuid) TO authenticated, service_role;

-- Recalcula para todos (cron)
CREATE OR REPLACE FUNCTION public.recalcular_conquistas_todos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid; _total int := 0;
BEGIN
  FOR _u IN SELECT id FROM public.profiles WHERE ativo = true LOOP
    PERFORM public.recalcular_conquistas_usuario(_u);
    _total := _total + 1;
  END LOOP;
  RETURN _total;
END $$;
GRANT EXECUTE ON FUNCTION public.recalcular_conquistas_todos() TO service_role;
