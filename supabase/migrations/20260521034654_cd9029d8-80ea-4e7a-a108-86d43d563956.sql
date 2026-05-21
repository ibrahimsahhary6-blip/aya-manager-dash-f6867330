-- Promote first admin to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role
FROM public.user_roles
WHERE role = 'admin'
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;

-- Tighten allowed_emails: super_admin only
DROP POLICY IF EXISTS "Admins manage allowed_emails" ON public.allowed_emails;
CREATE POLICY "Super admins manage allowed_emails"
ON public.allowed_emails
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Tighten app_settings writes: super_admin only (reads stay open to authenticated)
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Super admins manage settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
