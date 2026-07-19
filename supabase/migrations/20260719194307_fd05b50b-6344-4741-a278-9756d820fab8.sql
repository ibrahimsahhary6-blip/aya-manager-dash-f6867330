
DROP POLICY IF EXISTS "Allowed users insert students" ON public.students;
DROP POLICY IF EXISTS "Allowed users delete students" ON public.students;
DROP POLICY IF EXISTS "Allowed users insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allowed users update companies" ON public.companies;
DROP POLICY IF EXISTS "Allowed users delete companies" ON public.companies;

CREATE POLICY "Allowed users insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  );

CREATE POLICY "Allowed users delete students" ON public.students
  FOR DELETE TO authenticated
  USING (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  );

CREATE POLICY "Allowed users insert companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  );

CREATE POLICY "Allowed users update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  )
  WITH CHECK (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  );

CREATE POLICY "Allowed users delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (
    public.user_has_department_access(auth.uid(), public.battalion_department_id(battalion_id))
    AND public.can_admin_manage_students(auth.uid(), public.battalion_department_id(battalion_id))
  );
