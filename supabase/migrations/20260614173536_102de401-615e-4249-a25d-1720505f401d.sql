
-- Enums
CREATE TYPE public.reuniao_tipo AS ENUM ('individual', 'institucional');
CREATE TYPE public.reuniao_status AS ENUM ('agendada', 'realizada', 'cancelada');
CREATE TYPE public.reuniao_lembrete_tipo AS ENUM ('1d', '1h', '15min');

-- Tabela reunioes
CREATE TABLE public.reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  duracao_min INT NOT NULL DEFAULT 60,
  local TEXT,
  tipo public.reuniao_tipo NOT NULL DEFAULT 'individual',
  status public.reuniao_status NOT NULL DEFAULT 'agendada',
  resultado TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reunioes_data ON public.reunioes(data_inicio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes TO authenticated;
GRANT ALL ON public.reunioes TO service_role;
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read reunioes" ON public.reunioes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert reunioes" ON public.reunioes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update reunioes" ON public.reunioes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete reunioes" ON public.reunioes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reunioes_updated_at BEFORE UPDATE ON public.reunioes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Participantes
CREATE TABLE public.reuniao_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT participante_tipo_check CHECK ((lead_id IS NOT NULL)::int + (responsavel_id IS NOT NULL)::int = 1)
);
CREATE INDEX idx_part_reuniao ON public.reuniao_participantes(reuniao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reuniao_participantes TO authenticated;
GRANT ALL ON public.reuniao_participantes TO service_role;
ALTER TABLE public.reuniao_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read participantes" ON public.reuniao_participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write participantes" ON public.reuniao_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lembretes (controle de cron)
CREATE TABLE public.reuniao_lembretes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  tipo public.reuniao_lembrete_tipo NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, tipo)
);
GRANT SELECT, INSERT ON public.reuniao_lembretes TO authenticated;
GRANT ALL ON public.reuniao_lembretes TO service_role;
ALTER TABLE public.reuniao_lembretes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read lembretes" ON public.reuniao_lembretes FOR SELECT TO authenticated USING (true);
