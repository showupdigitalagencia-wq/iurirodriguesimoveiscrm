ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.imoveis.latitude IS 'Latitude (WGS84) — preenchido manualmente ou por importador/geocoder';
COMMENT ON COLUMN public.imoveis.longitude IS 'Longitude (WGS84) — preenchido manualmente ou por importador/geocoder';