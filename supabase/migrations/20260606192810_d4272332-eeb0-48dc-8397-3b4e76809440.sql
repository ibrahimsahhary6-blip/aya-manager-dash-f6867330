
DROP POLICY IF EXISTS "Approved users update attendance" ON public.attendance;
CREATE POLICY "Approved users update attendance"
ON public.attendance
FOR UPDATE
USING (
  public.is_approved_user() AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  public.is_approved_user() AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Approved users update recitations" ON public.recitations;
CREATE POLICY "Approved users update recitations"
ON public.recitations
FOR UPDATE
USING (
  public.is_approved_user() AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  public.is_approved_user() AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);
