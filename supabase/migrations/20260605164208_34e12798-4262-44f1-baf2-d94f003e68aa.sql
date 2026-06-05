
-- 1) Helper: is_approved_user (defence in depth)
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE user_id = auth.uid()), false)
$$;

-- 2) Lock down recitations write access to moderator/admin/super_admin
DROP POLICY IF EXISTS "Authenticated insert recitations" ON public.recitations;
DROP POLICY IF EXISTS "Authenticated update recitations" ON public.recitations;
DROP POLICY IF EXISTS "Authenticated delete recitations" ON public.recitations;

CREATE POLICY "Staff insert recitations" ON public.recitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Staff update recitations" ON public.recitations
  FOR UPDATE TO authenticated
  USING (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Staff delete recitations" ON public.recitations
  FOR DELETE TO authenticated
  USING (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 3) Lock down attendance write access to moderator/admin/super_admin
DROP POLICY IF EXISTS "Authenticated insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated delete attendance" ON public.attendance;

CREATE POLICY "Staff insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Staff update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Staff delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    public.is_approved_user() AND (
      public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 4) Require approval for sensitive reads (defence in depth)
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Approved users read students" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated read recitations" ON public.recitations;
CREATE POLICY "Approved users read recitations" ON public.recitations
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance;
CREATE POLICY "Approved users read attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated read battalions" ON public.battalions;
CREATE POLICY "Approved users read battalions" ON public.battalions
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated read companies" ON public.companies;
CREATE POLICY "Approved users read companies" ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated read settings" ON public.app_settings;
CREATE POLICY "Approved users read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

-- 5) Fix privilege escalation in can_admin_manage_students:
-- Require at least moderator when users_can_manage_students flag is on.
CREATE OR REPLACE FUNCTION public.can_admin_manage_students(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'admin'::app_role)
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'admins_can_manage_students'), 'false') = 'true'
    )
    OR (
      public.has_role(_user_id, 'moderator'::app_role)
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'users_can_manage_students'), 'false') = 'true'
    )
$$;
