
-- 1) Tighten profile protection: admins can only toggle is_approved/approved_at; only super_admin can change email
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  -- user_id is immutable for everyone
  NEW.user_id := OLD.user_id;

  IF NOT is_super THEN
    -- email may only be changed by super_admin
    NEW.email := OLD.email;
  END IF;

  IF NOT (is_admin OR is_super) THEN
    -- regular users cannot self-approve
    NEW.is_approved := OLD.is_approved;
    NEW.approved_at := OLD.approved_at;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Restrict users_can_manage_students to super_admin only
DROP POLICY IF EXISTS "Admins update permission flags" ON public.app_settings;
DROP POLICY IF EXISTS "Admins insert permission flags" ON public.app_settings;

CREATE POLICY "Admins update admin manage flag" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND key = 'admins_can_manage_students')
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND key = 'admins_can_manage_students');

CREATE POLICY "Admins insert admin manage flag" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND key = 'admins_can_manage_students');
