CREATE OR REPLACE FUNCTION public.delete_attendance_records(p_from date, p_to date, p_employee uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_events integer;
  v_days integer;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: only administrators can delete attendance records';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR NOT (
    p_from = p_to OR (
      p_from = date_trunc('month', p_from)::date
      AND p_to = (date_trunc('month', p_from) + interval '1 month - 1 day')::date
    )
  ) THEN
    RAISE EXCEPTION 'Select a single day or a complete month';
  END IF;
  DELETE FROM public.attendance_events
    WHERE work_date BETWEEN p_from AND p_to
      AND (p_employee IS NULL OR user_id = p_employee);
  GET DIAGNOSTICS v_events = ROW_COUNT;
  DELETE FROM public.attendance_days
    WHERE work_date BETWEEN p_from AND p_to
      AND (p_employee IS NULL OR user_id = p_employee);
  GET DIAGNOSTICS v_days = ROW_COUNT;
  INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, payload)
    VALUES (v_actor, auth.jwt()->>'email', 'delete_attendance_records', 'attendance_days',
      coalesce(p_employee::text, 'all') || ':' || p_from::text || ':' || p_to::text,
      jsonb_build_object('from', p_from, 'to', p_to, 'employee', p_employee, 'all_employees', p_employee IS NULL,
        'deleted_events', v_events, 'deleted_days', v_days));
  RETURN jsonb_build_object('deleted_events', v_events, 'deleted_days', v_days);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_attendance_records(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_attendance_records(date, date, uuid) TO authenticated;