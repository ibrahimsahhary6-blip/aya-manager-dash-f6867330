
-- Add department scoping to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Drop old uniqueness (user_id, role) if it exists, replace with (user_id, role, department_id)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.user_roles'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(user_id, role)%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%department_id%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT %I', c);
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_dept_uniq
  ON public.user_roles (user_id, role, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Helper: list of department ids the user can access
-- super_admin or any role row with NULL department_id => returns NULL meaning "all"
-- otherwise => array of allowed department ids
CREATE OR REPLACE FUNCTION public.user_allowed_department_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'super_admin'::app_role) THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND department_id IS NULL
        AND role IN ('admin'::app_role, 'moderator'::app_role)
    ) THEN NULL
    ELSE COALESCE(
      (SELECT array_agg(DISTINCT department_id)
       FROM public.user_roles
       WHERE user_id = _user_id AND department_id IS NOT NULL),
      ARRAY[]::uuid[]
    )
  END
$$;

-- Convenience boolean
CREATE OR REPLACE FUNCTION public.user_has_department_access(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.user_allowed_department_ids(_user_id) IS NULL THEN true
    ELSE _department_id = ANY(public.user_allowed_department_ids(_user_id))
  END
$$;
