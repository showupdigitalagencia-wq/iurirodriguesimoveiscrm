
CREATE TABLE public.corretor_disponibilidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('recorrente','bloqueio')),
  dia_semana SMALLINT CHECK (dia_semana BETWEEN 0 AND 6),
  data DATE,
  hora_inicio TIME,
  hora_fim TIME,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'recorrente' AND dia_semana IS NOT NULL AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND data IS NULL)
    OR
    (tipo = 'bloqueio' AND data IS NOT NULL)
  )
);

CREATE INDEX idx_corretor_disp_corretor ON public.corretor_disponibilidade(corretor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretor_disponibilidade TO authenticated;
GRANT ALL ON public.corretor_disponibilidade TO service_role;

ALTER TABLE public.corretor_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor gerencia sua disponibilidade"
  ON public.corretor_disponibilidade FOR ALL
  USING (auth.uid() = corretor_id)
  WITH CHECK (auth.uid() = corretor_id);

CREATE POLICY "Admin vê toda disponibilidade"
  ON public.corretor_disponibilidade FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin edita toda disponibilidade"
  ON public.corretor_disponibilidade FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Executivo vê disponibilidade de corretores do mesmo responsavel (canal)
CREATE POLICY "Executivo vê disp de seus corretores"
  ON public.corretor_disponibilidade FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pc
      JOIN public.profiles pe ON pe.responsavel_id = pc.responsavel_id
      WHERE pc.id = corretor_disponibilidade.corretor_id
        AND pe.id = auth.uid()
        AND pc.responsavel_id IS NOT NULL
    )
  );

CREATE TRIGGER update_corretor_disp_updated_at
  BEFORE UPDATE ON public.corretor_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
