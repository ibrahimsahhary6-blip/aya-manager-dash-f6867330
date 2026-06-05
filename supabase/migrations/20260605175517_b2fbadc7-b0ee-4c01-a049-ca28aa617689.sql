
-- 1) Backups: let super_admin delete too
DROP POLICY IF EXISTS "Admin delete backups" ON public.backups;
CREATE POLICY "Admins delete backups"
ON public.backups
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 2) Profiles: admins must not delete or update super_admin profiles
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete non super admin profiles"
ON public.profiles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND NOT public.has_role(user_id, 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update non super admin profiles"
ON public.profiles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND NOT public.has_role(user_id, 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND NOT public.has_role(user_id, 'super_admin'::app_role)
);

-- 3) Profiles: column-safe self-service update.
-- Users may only update their own row, and only if sensitive fields stay unchanged.
DROP POLICY IF EXISTS "Users update own first login" ON public.profiles;
CREATE POLICY "Users update own first login"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM public.profiles p WHERE p.user_id = auth.uid())
  AND email       IS NOT DISTINCT FROM (SELECT p.email       FROM public.profiles p WHERE p.user_id = auth.uid())
);
