CREATE OR REPLACE FUNCTION public.add_lead_canal_value(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL OR length(trim(_value)) = 0 THEN
    RAISE EXCEPTION 'valor invalido';
  END IF;
  IF _value !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'valor deve conter apenas a-z, 0-9 e _';
  END IF;
  EXECUTE format('ALTER TYPE public.lead_canal ADD VALUE IF NOT EXISTS %L', _value);
END;
$$;

REVOKE ALL ON FUNCTION public.add_lead_canal_value(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_lead_canal_value(text) TO service_role;