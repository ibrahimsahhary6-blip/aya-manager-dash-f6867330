
-- 1. department_settings table
CREATE TABLE public.department_settings (
  department_id uuid PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
  admins_can_manage_students boolean,
  users_can_manage_students boolean,
  extra_juz_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.department_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.department_settings TO authenticated;
GRANT ALL ON public.department_settings TO service_role;

ALTER TABLE public.department_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept_settings_read_authenticated"
  ON public.department_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "dept_settings_write_super_admin"
  ON public.department_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_dept_settings_updated_at
  BEFORE UPDATE ON public.department_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. helper: battalion → department
CREATE OR REPLACE FUNCTION public.battalion_department_id(_battalion_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.battalions WHERE id = _battalion_id
$$;

-- 3. department-aware permission check (overload)
CREATE OR REPLACE FUNCTION public.can_admin_manage_students(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'super_admin'::app_role) THEN true
    WHEN public.has_role(_user_id, 'admin'::app_role) THEN
      COALESCE(
        (SELECT admins_can_manage_students FROM public.department_settings WHERE department_id = _department_id),
        COALESCE((SELECT value FROM public.app_settings WHERE key = 'admins_can_manage_students'), 'false') = 'true'
      )
    ELSE
      COALESCE(
        (SELECT users_can_manage_students FROM public.department_settings WHERE department_id = _department_id),
        COALESCE((SELECT value FROM public.app_settings WHERE key = 'users_can_manage_students'), 'false') = 'true'
      )
  END
$$;

-- 4. extra-juz enabled per department (default true when no row)
CREATE OR REPLACE FUNCTION public.department_extra_juz_enabled(_department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT extra_juz_enabled FROM public.department_settings WHERE department_id = _department_id),
    true
  )
$$;

-- 5. update RLS on students and companies to pass department context
DROP POLICY IF EXISTS "Allowed users insert students" ON public.students;
DROP POLICY IF EXISTS "Allowed users delete students" ON public.students;
DROP POLICY IF EXISTS "Allowed users update students" ON public.students;

CREATE POLICY "Allowed users insert students"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));

CREATE POLICY "Allowed users delete students"
  ON public.students FOR DELETE TO authenticated
  USING (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));

CREATE POLICY "Allowed users update students"
  ON public.students FOR UPDATE TO authenticated
  USING (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)))
  WITH CHECK (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));

DROP POLICY IF EXISTS "Allowed users insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allowed users delete companies" ON public.companies;
DROP POLICY IF EXISTS "Allowed users update companies" ON public.companies;

CREATE POLICY "Allowed users insert companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));

CREATE POLICY "Allowed users delete companies"
  ON public.companies FOR DELETE TO authenticated
  USING (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));

CREATE POLICY "Allowed users update companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)))
  WITH CHECK (public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id)));
