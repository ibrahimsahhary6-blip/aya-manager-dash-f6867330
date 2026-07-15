DROP POLICY IF EXISTS "Allowed users update students" ON public.students;
CREATE POLICY "Allowed users update students" ON public.students FOR UPDATE
USING (
  user_has_department_access(auth.uid(), battalion_department_id(battalion_id))
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR can_admin_manage_students(auth.uid(), battalion_department_id(battalion_id))
  )
)
WITH CHECK (
  user_has_department_access(auth.uid(), battalion_department_id(battalion_id))
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR can_admin_manage_students(auth.uid(), battalion_department_id(battalion_id))
  )
);