
DROP POLICY IF EXISTS "Admins delete backups" ON public.backups;
CREATE POLICY "Admins delete backups" ON public.backups
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins delete non super admin profiles" ON public.profiles;
CREATE POLICY "Admins delete non super admin profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (NOT has_role(user_id, 'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins update non super admin profiles" ON public.profiles;
CREATE POLICY "Admins update non super admin profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (NOT has_role(user_id, 'super_admin'::app_role)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (NOT has_role(user_id, 'super_admin'::app_role)));

DROP POLICY IF EXISTS "Users update own first login" ON public.profiles;
CREATE POLICY "Users update own first login" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    (user_id = auth.uid())
    AND (NOT (is_approved IS DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.user_id = auth.uid())))
    AND (NOT (approved_at IS DISTINCT FROM (SELECT p.approved_at FROM profiles p WHERE p.user_id = auth.uid())))
    AND (NOT (email IS DISTINCT FROM (SELECT p.email FROM profiles p WHERE p.user_id = auth.uid())))
  );
