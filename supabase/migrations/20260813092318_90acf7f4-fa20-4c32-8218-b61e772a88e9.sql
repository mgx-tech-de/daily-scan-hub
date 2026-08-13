
CREATE TYPE public.app_role AS ENUM ('admin','employee');
CREATE TYPE public.event_kind AS ENUM ('check_in','check_out');
CREATE TYPE public.day_status AS ENUM ('present','incomplete','absent','leave','holiday','weekend');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  department text,
  position text,
  hire_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  org_name text NOT NULL DEFAULT 'ChronoDesk',
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  shift_start text NOT NULL DEFAULT '09:00',
  shift_end text NOT NULL DEFAULT '18:30',
  qr_open text NOT NULL DEFAULT '08:00',
  daily_cutoff text NOT NULL DEFAULT '23:59',
  grace_minutes int NOT NULL DEFAULT 5,
  break_threshold_minutes int NOT NULL DEFAULT 300,
  break_deduction_minutes int NOT NULL DEFAULT 30,
  count_unapproved_overtime boolean NOT NULL DEFAULT false,
  min_dwell_seconds int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.settings (id) VALUES (1);

CREATE TABLE public.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date date NOT NULL UNIQUE,
  secret text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qr_tokens TO authenticated;
GRANT ALL ON public.qr_tokens TO service_role;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr admin read" ON public.qr_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  kind public.event_kind NOT NULL,
  raw_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'qr_scan',
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.attendance_events (user_id, work_date);
GRANT SELECT ON public.attendance_events TO authenticated;
GRANT ALL ON public.attendance_events TO service_role;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events read" ON public.attendance_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.attendance_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in_at timestamptz,
  check_out_at timestamptz,
  raw_check_in_at timestamptz,
  gross_minutes int NOT NULL DEFAULT 0,
  break_minutes int NOT NULL DEFAULT 0,
  net_minutes int NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  undertime_minutes int NOT NULL DEFAULT 0,
  status public.day_status NOT NULL DEFAULT 'incomplete',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX ON public.attendance_days (work_date);
GRANT SELECT ON public.attendance_days TO authenticated;
GRANT ALL ON public.attendance_days TO service_role;
ALTER TABLE public.attendance_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "days read" ON public.attendance_days FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  reason text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log (created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_days;
