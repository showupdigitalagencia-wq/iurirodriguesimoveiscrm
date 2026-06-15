ALTER TABLE public.reuniao_participantes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reuniao_participantes
  DROP CONSTRAINT IF EXISTS participante_tipo_check;

ALTER TABLE public.reuniao_participantes
  ADD CONSTRAINT participante_tipo_check CHECK (
    ((lead_id IS NOT NULL)::int + (responsavel_id IS NOT NULL)::int + (user_id IS NOT NULL)::int) = 1
  );

CREATE INDEX IF NOT EXISTS idx_part_user ON public.reuniao_participantes(user_id);