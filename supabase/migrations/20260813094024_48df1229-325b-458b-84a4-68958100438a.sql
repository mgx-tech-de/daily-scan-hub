REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;