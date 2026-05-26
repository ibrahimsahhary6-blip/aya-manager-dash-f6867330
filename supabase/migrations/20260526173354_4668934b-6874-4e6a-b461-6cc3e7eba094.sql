
-- Settings flag: whether admins (non-super) can add/delete students and delete companies
INSERT INTO public.app_settings (key, value) VALUES ('admins_can_manage_students', 'false')
ON CONFLICT (key) DO NOTHING;

-- Helper: who is allowed to add/delete students and delete companies
CREATE OR REPLACE FUNCTION public.can_admin_manage_students(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'admin'::app_role)
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'admins_can_manage_students'), 'false') = 'true'
    )
$$;

-- Students: INSERT — replace
DROP POLICY IF EXISTS "Admins insert students" ON public.students;
CREATE POLICY "Allowed users insert students"
ON public.students FOR INSERT TO authenticated
WITH CHECK (public.can_admin_manage_students(auth.uid()));

-- Students: hard DELETE — replace
DROP POLICY IF EXISTS "Only admin can permanently delete students" ON public.students;
CREATE POLICY "Allowed users delete students"
ON public.students FOR DELETE TO authenticated
USING (public.can_admin_manage_students(auth.uid()));

-- Companies: DELETE — replace
DROP POLICY IF EXISTS "Admins delete companies" ON public.companies;
CREATE POLICY "Allowed users delete companies"
ON public.companies FOR DELETE TO authenticated
USING (public.can_admin_manage_students(auth.uid()));

-- Let any admin (not just super_admin) update the new permission flag
CREATE POLICY "Admins update permission flag"
ON public.app_settings FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND key = 'admins_can_manage_students'
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND key = 'admins_can_manage_students'
);

CREATE POLICY "Admins insert permission flag"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND key = 'admins_can_manage_students'
);
