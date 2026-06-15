
CREATE OR REPLACE FUNCTION public.handle_lead_fechado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa = 'fechado' AND (OLD.etapa IS DISTINCT FROM 'fechado') THEN
    NEW.is_corretor := true;
    IF NEW.fechado_em IS NULL THEN
      NEW.fechado_em := now();
    END IF;
    INSERT INTO public.lead_historico (lead_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'contratado_corretor', jsonb_build_object('fechado_em', NEW.fechado_em));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_fechado ON public.leads;
CREATE TRIGGER trg_leads_fechado
BEFORE UPDATE OF etapa ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.handle_lead_fechado();
