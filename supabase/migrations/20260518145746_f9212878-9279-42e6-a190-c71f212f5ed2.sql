
-- Sequence for student id
CREATE SEQUENCE IF NOT EXISTS public.student_code_seq START 1;

CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE DEFAULT ('ST-' || lpad(nextval('public.student_code_seq')::text, 6, '0')),
  full_name TEXT NOT NULL,
  halaqa TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.student_code_seq OWNED BY public.students.student_code;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Public delete students" ON public.students FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX students_halaqa_idx ON public.students(halaqa);
CREATE INDEX students_full_name_idx ON public.students(full_name);
