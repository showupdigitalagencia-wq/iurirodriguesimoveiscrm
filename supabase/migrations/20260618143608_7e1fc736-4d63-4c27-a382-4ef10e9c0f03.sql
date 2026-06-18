
-- 1. Add codigo column
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS codigo text UNIQUE;

-- 2. Sequence for auto-generated codes
CREATE SEQUENCE IF NOT EXISTS public.imoveis_codigo_seq START 1;

-- 3. Backfill existing rows (ordered by created_at), only where codigo is null
WITH ord AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.imoveis WHERE codigo IS NULL
)
UPDATE public.imoveis i
SET codigo = 'IM-' || lpad(ord.rn::text, 4, '0')
FROM ord WHERE i.id = ord.id;

-- 4. Advance the sequence past existing numeric IM-#### codes
SELECT setval(
  'public.imoveis_codigo_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(codigo, '^IM-', ''), '')::int)
      FROM public.imoveis
      WHERE codigo ~ '^IM-\d+$'
    ), 0)
  )
);

-- 5. Trigger to auto-generate codigo on insert when null/empty
CREATE OR REPLACE FUNCTION public.imoveis_set_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR length(trim(NEW.codigo)) = 0 THEN
    NEW.codigo := 'IM-' || lpad(nextval('public.imoveis_codigo_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_imoveis_set_codigo ON public.imoveis;
CREATE TRIGGER trg_imoveis_set_codigo
BEFORE INSERT ON public.imoveis
FOR EACH ROW EXECUTE FUNCTION public.imoveis_set_codigo();
