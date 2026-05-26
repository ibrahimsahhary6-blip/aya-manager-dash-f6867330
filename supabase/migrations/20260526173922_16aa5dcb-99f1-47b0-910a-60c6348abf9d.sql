
INSERT INTO public.app_settings (key, value) VALUES ('users_can_manage_students', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_admin_manage_students(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'admin'::app_role)
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'admins_can_manage_students'), 'false') = 'true'
    )
    OR (
      _user_id IS NOT NULL
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'users_can_manage_students'), 'false') = 'true'
    )
$$;

DROP POLICY IF EXISTS "Admins update permission flag" ON public.app_settings;
DROP POLICY IF EXISTS "Admins insert permission flag" ON public.app_settings;

CREATE POLICY "Admins update permission flags"
ON public.app_settings FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND key IN ('admins_can_manage_students', 'users_can_manage_students')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND key IN ('admins_can_manage_students', 'users_can_manage_students')
);

CREATE POLICY "Admins insert permission flags"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND key IN ('admins_can_manage_students', 'users_can_manage_students')
);
