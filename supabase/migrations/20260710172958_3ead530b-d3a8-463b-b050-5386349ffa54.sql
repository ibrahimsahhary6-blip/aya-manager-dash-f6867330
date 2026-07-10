
ALTER TABLE public.battalions DROP CONSTRAINT IF EXISTS battalions_name_key;
ALTER TABLE public.battalions ADD CONSTRAINT battalions_department_id_name_key UNIQUE (department_id, name);
