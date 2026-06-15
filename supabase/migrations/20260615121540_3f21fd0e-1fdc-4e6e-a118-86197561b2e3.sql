
CREATE TABLE public.vendas_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.vendas_leads(id) ON DELETE CASCADE,
  corretor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endereco text NOT NULL,
  data_inicio timestamptz NOT NULL,
  duracao_min integer NOT NULL DEFAULT 60,
  observacoes text,
  google_event_id text,
  status text NOT NULL DEFAULT 'agendada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendas_visitas_corretor ON public.vendas_visitas(corretor_id);
CREATE INDEX idx_vendas_visitas_data ON public.vendas_visitas(data_inicio);
CREATE INDEX idx_vendas_visitas_lead ON public.vendas_visitas(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_visitas TO authenticated;
GRANT ALL ON public.vendas_visitas TO service_role;

ALTER TABLE public.vendas_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor gerencia suas visitas" ON public.vendas_visitas
  FOR ALL TO authenticated
  USING (corretor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (corretor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vendas_visitas_updated_at
  BEFORE UPDATE ON public.vendas_visitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
