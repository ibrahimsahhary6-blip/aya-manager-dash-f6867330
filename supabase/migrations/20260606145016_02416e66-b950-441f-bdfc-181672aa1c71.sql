
-- Fix permission function to include 'user' role (default role for new users)
CREATE OR REPLACE FUNCTION public.can_admin_manage_students(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'admin'::app_role)
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'admins_can_manage_students'), 'false') = 'true'
    )
    OR (
      (public.has_role(_user_id, 'user'::app_role) OR public.has_role(_user_id, 'moderator'::app_role))
      AND COALESCE((SELECT value FROM public.app_settings WHERE key = 'users_can_manage_students'), 'false') = 'true'
    )
$function$;

-- Update companies policies to respect the manage-students flags as well (so users can add/edit/delete السرية)
DROP POLICY IF EXISTS "Admins insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admins update companies" ON public.companies;
DROP POLICY IF EXISTS "Admins delete companies" ON public.companies;

CREATE POLICY "Allowed users insert companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_manage_students(auth.uid()));

CREATE POLICY "Allowed users update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.can_admin_manage_students(auth.uid()))
  WITH CHECK (public.can_admin_manage_students(auth.uid()));

CREATE POLICY "Allowed users delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (public.can_admin_manage_students(auth.uid()));

-- Ensure students insert policy exists with proper check
DROP POLICY IF EXISTS "Allowed users insert students" ON public.students;
CREATE POLICY "Allowed users insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_manage_students(auth.uid()));
