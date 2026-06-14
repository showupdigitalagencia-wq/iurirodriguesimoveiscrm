ALTER TABLE public.responsaveis
  ADD COLUMN IF NOT EXISTS onesignal_external_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onesignal_external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_responsaveis_onesignal_external_id
  ON public.responsaveis(onesignal_external_id)
  WHERE onesignal_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_external_id
  ON public.profiles(onesignal_external_id)
  WHERE onesignal_external_id IS NOT NULL;