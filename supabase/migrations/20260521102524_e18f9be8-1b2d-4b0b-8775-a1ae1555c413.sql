
-- Allow admins (not just super_admin) to read audit log
DROP POLICY IF EXISTS "Super admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Generic trigger to log data changes for activity feed
CREATE OR REPLACE FUNCTION public.log_data_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity text := TG_ARGV[0];
  label text;
  action_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_key := entity || '_created';
    label := COALESCE(NEW.full_name, NEW.name, NEW.surah, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    action_key := entity || '_updated';
    label := COALESCE(NEW.full_name, NEW.name, NEW.surah, NULL);
  ELSIF TG_OP = 'DELETE' THEN
    action_key := entity || '_deleted';
    label := COALESCE(OLD.full_name, OLD.name, OLD.surah, NULL);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (
    auth.uid(),
    public.current_actor_email(),
    action_key,
    jsonb_build_object('entity', entity, 'label', label,
      'row_id', COALESCE(NEW.id::text, OLD.id::text))
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Special trigger for students: log soft-delete (deleted_at change) as a delete event
CREATE OR REPLACE FUNCTION public.log_student_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_key := 'student_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      action_key := 'student_deleted';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      action_key := 'student_restored';
    ELSE
      action_key := 'student_updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_key := 'student_purged';
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (
    auth.uid(),
    public.current_actor_email(),
    action_key,
    jsonb_build_object('entity', 'student',
      'label', COALESCE(NEW.full_name, OLD.full_name),
      'row_id', COALESCE(NEW.id::text, OLD.id::text))
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attendance trigger that includes student name
CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sname text;
  action_key text;
  meta jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT full_name INTO sname FROM public.students WHERE id = OLD.student_id;
    action_key := 'attendance_deleted';
    meta := jsonb_build_object('entity','attendance','label', sname,
      'date', OLD.attended_on, 'present', OLD.present);
  ELSE
    SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
    action_key := CASE TG_OP WHEN 'INSERT' THEN 'attendance_created' ELSE 'attendance_updated' END;
    meta := jsonb_build_object('entity','attendance','label', sname,
      'date', NEW.attended_on, 'present', NEW.present, 'rating', NEW.rating);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (auth.uid(), public.current_actor_email(), action_key, meta);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_log_students ON public.students;
CREATE TRIGGER trg_log_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_change();

DROP TRIGGER IF EXISTS trg_log_battalions ON public.battalions;
CREATE TRIGGER trg_log_battalions
  AFTER INSERT OR UPDATE OR DELETE ON public.battalions
  FOR EACH ROW EXECUTE FUNCTION public.log_data_change('battalion');

DROP TRIGGER IF EXISTS trg_log_companies ON public.companies;
CREATE TRIGGER trg_log_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.log_data_change('company');

DROP TRIGGER IF EXISTS trg_log_attendance ON public.attendance;
CREATE TRIGGER trg_log_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

DROP TRIGGER IF EXISTS trg_log_recitations ON public.recitations;
CREATE TRIGGER trg_log_recitations
  AFTER INSERT OR UPDATE OR DELETE ON public.recitations
  FOR EACH ROW EXECUTE FUNCTION public.log_data_change('recitation');
