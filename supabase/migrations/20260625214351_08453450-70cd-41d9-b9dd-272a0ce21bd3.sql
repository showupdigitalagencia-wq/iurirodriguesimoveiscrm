
-- Helper: normaliza telefone para padrão BR com 55
CREATE OR REPLACE FUNCTION public.normalize_phone_br(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  -- remove zeros à esquerda (ex: 021...)
  d := regexp_replace(d, '^0+', '');
  IF d = '' THEN RETURN NULL; END IF;
  -- já vem com 55 + DDD (12 ou 13 dígitos): mantém
  IF length(d) IN (12, 13) AND left(d, 2) = '55' THEN
    RETURN d;
  END IF;
  -- 10 ou 11 dígitos (DDD + número): adiciona 55
  IF length(d) IN (10, 11) THEN
    RETURN '55' || d;
  END IF;
  -- 8 ou 9 dígitos (sem DDD): retorna como está; helper de UI lida
  RETURN d;
END;
$$;

-- Trigger genérico para colunas chamadas "telefone"
CREATE OR REPLACE FUNCTION public.tg_normalize_telefone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.telefone := public.normalize_phone_br(NEW.telefone);
  RETURN NEW;
END;
$$;

-- Trigger para contratos (coluna locatario_telefone)
CREATE OR REPLACE FUNCTION public.tg_normalize_locatario_telefone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.locatario_telefone := public.normalize_phone_br(NEW.locatario_telefone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_normalize_phone ON public.leads;
CREATE TRIGGER trg_leads_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_telefone();

DROP TRIGGER IF EXISTS trg_vendas_leads_normalize_phone ON public.vendas_leads;
CREATE TRIGGER trg_vendas_leads_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON public.vendas_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_telefone();

DROP TRIGGER IF EXISTS trg_candidatos_normalize_phone ON public.candidatos;
CREATE TRIGGER trg_candidatos_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON public.candidatos
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_telefone();

DROP TRIGGER IF EXISTS trg_contratos_normalize_phone ON public.contratos;
CREATE TRIGGER trg_contratos_normalize_phone
  BEFORE INSERT OR UPDATE OF locatario_telefone ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_locatario_telefone();

-- Correção em massa dos registros existentes (trigger cuida automaticamente
-- de cada UPDATE, mas chamamos a função explicitamente para clareza).
UPDATE public.leads
  SET telefone = public.normalize_phone_br(telefone)
  WHERE telefone IS NOT NULL
    AND telefone IS DISTINCT FROM public.normalize_phone_br(telefone);

UPDATE public.vendas_leads
  SET telefone = public.normalize_phone_br(telefone)
  WHERE telefone IS NOT NULL
    AND telefone IS DISTINCT FROM public.normalize_phone_br(telefone);

UPDATE public.candidatos
  SET telefone = public.normalize_phone_br(telefone)
  WHERE telefone IS NOT NULL
    AND telefone IS DISTINCT FROM public.normalize_phone_br(telefone);

UPDATE public.contratos
  SET locatario_telefone = public.normalize_phone_br(locatario_telefone)
  WHERE locatario_telefone IS NOT NULL
    AND locatario_telefone IS DISTINCT FROM public.normalize_phone_br(locatario_telefone);
