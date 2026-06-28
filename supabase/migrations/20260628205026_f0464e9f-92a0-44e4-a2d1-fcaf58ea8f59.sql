
-- 1. Departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select_authenticated"
  ON public.departments FOR SELECT TO authenticated
  USING (public.is_approved_user());

CREATE POLICY "departments_insert_admin"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "departments_update_admin"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "departments_delete_admin"
  ON public.departments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Seed default departments
INSERT INTO public.departments (name, sort_order) VALUES ('642', 1), ('مختلف الصنوف', 2);

-- 3. Add department_id to battalions
ALTER TABLE public.battalions ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;

-- Default all existing battalions to 642
UPDATE public.battalions
SET department_id = (SELECT id FROM public.departments WHERE name = '642')
WHERE department_id IS NULL;

ALTER TABLE public.battalions ALTER COLUMN department_id SET NOT NULL;

CREATE INDEX idx_battalions_department_id ON public.battalions(department_id);
