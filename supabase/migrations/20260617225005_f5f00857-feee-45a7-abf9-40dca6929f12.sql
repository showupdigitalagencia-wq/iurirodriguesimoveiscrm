
CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_previsto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(12,2),
  data_pagamento DATE,
  multa NUMERIC(12,2) DEFAULT 0,
  juros NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','atrasado','pendente','inadimplente')),
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contrato_id, mes_referencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_administrativo_all_pagamentos" ON public.pagamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_administrativo(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_administrativo(auth.uid()));
CREATE TRIGGER pagamentos_updated BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_pagamentos_contrato ON public.pagamentos(contrato_id);
CREATE INDEX idx_pagamentos_status ON public.pagamentos(status);

CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','telefone','email','presencial','outro')),
  mensagem TEXT,
  realizada_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_administrativo_all_cobrancas" ON public.cobrancas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_administrativo(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_administrativo(auth.uid()));
CREATE INDEX idx_cobrancas_contrato ON public.cobrancas(contrato_id);
