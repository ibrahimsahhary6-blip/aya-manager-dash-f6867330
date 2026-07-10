DROP INDEX IF EXISTS public.uniq_battalions_normalized_name;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_battalions_dept_normalized_name
  ON public.battalions (department_id, public.normalize_arabic(name));