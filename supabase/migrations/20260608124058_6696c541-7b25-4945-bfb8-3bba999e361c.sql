DROP POLICY IF EXISTS "Approved users update attendance" ON public.attendance;
CREATE POLICY "Approved users update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS "Approved users update recitations" ON public.recitations;
CREATE POLICY "Approved users update recitations" ON public.recitations
  FOR UPDATE TO authenticated
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());