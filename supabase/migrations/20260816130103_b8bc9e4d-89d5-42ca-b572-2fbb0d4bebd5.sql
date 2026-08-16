ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS max_daily_sessions integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';

ALTER TABLE public.settings
  ADD CONSTRAINT settings_max_daily_sessions_check CHECK (max_daily_sessions BETWEEN 1 AND 12);

ALTER TABLE public.settings
  ADD CONSTRAINT settings_language_check CHECK (language IN ('de','en','ar','tr','ru'));

ALTER TABLE public.settings
  ADD CONSTRAINT settings_theme_check CHECK (theme IN ('dark','light'));