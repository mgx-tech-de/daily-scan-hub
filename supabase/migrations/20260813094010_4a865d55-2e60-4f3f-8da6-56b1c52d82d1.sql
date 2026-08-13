CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "days read" ON public.attendance_days;
CREATE POLICY "days read" ON public.attendance_days
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

DROP POLICY IF EXISTS "events read" ON public.attendance_events;
CREATE POLICY "events read" ON public.attendance_events
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

DROP POLICY IF EXISTS "roles read" ON public.user_roles;
CREATE POLICY "roles read" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));