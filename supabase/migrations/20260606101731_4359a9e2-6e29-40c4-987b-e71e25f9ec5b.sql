
DROP POLICY IF EXISTS "Staff insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff insert recitations" ON public.recitations;
DROP POLICY IF EXISTS "Staff update recitations" ON public.recitations;

CREATE POLICY "Approved users insert attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (is_approved_user());
CREATE POLICY "Approved users update attendance" ON public.attendance
  FOR UPDATE TO authenticated USING (is_approved_user()) WITH CHECK (is_approved_user());

CREATE POLICY "Approved users insert recitations" ON public.recitations
  FOR INSERT TO authenticated WITH CHECK (is_approved_user());
CREATE POLICY "Approved users update recitations" ON public.recitations
  FOR UPDATE TO authenticated USING (is_approved_user()) WITH CHECK (is_approved_user());
