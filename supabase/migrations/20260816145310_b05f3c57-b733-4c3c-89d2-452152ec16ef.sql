ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS office_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS office_lat double precision,
  ADD COLUMN IF NOT EXISTS office_lng double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS require_geofence boolean NOT NULL DEFAULT false;