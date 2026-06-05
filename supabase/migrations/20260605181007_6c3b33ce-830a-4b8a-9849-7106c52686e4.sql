
-- 1) audit_log: explicit deny on client writes (SECURITY DEFINER triggers and service_role bypass RLS)
CREATE POLICY "Deny client inserts on audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on audit log" ON public.audit_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes on audit log" ON public.audit_log
  FOR DELETE TO authenticated USING (false);

-- 2) companies: align DELETE with INSERT/UPDATE (admin/super_admin only)
DROP POLICY IF EXISTS "Allowed users delete companies" ON public.companies;
CREATE POLICY "Admins delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3) user_roles: remove admin role-management policy; only super_admin manages roles
DROP POLICY IF EXISTS "Admins manage non-super roles" ON public.user_roles;
