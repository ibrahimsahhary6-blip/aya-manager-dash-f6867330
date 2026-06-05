DROP POLICY IF EXISTS "Admins update students" ON public.students;
CREATE POLICY "Allowed users update students"
ON public.students
FOR UPDATE
TO authenticated
USING (public.can_admin_manage_students(auth.uid()))
WITH CHECK (public.can_admin_manage_students(auth.uid()));