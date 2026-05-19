
-- Battalions
CREATE TABLE public.battalions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.battalions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read battalions" ON public.battalions FOR SELECT USING (true);
CREATE POLICY "Public insert battalions" ON public.battalions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update battalions" ON public.battalions FOR UPDATE USING (true);
CREATE POLICY "Public delete battalions" ON public.battalions FOR DELETE USING (true);

-- Companies (under battalion)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battalion_id uuid NOT NULL REFERENCES public.battalions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battalion_id, name)
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public insert companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update companies" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Public delete companies" ON public.companies FOR DELETE USING (true);

-- Seed default 4 battalions x 4 companies
WITH b AS (
  INSERT INTO public.battalions (name, sort_order) VALUES
    ('الكتيبة الأولى', 1),
    ('الكتيبة الثانية', 2),
    ('الكتيبة الثالثة', 3),
    ('الكتيبة الرابعة', 4)
  RETURNING id, sort_order
)
INSERT INTO public.companies (battalion_id, name, sort_order)
SELECT b.id, c.name, c.sort_order
FROM b
CROSS JOIN (VALUES
  ('السرية الأولى', 1),
  ('السرية الثانية', 2),
  ('السرية الثالثة', 3),
  ('السرية الرابعة', 4)
) AS c(name, sort_order);

-- Students: drop halaqa, add battalion_id/company_id
ALTER TABLE public.students DROP COLUMN IF EXISTS halaqa;
ALTER TABLE public.students
  ADD COLUMN battalion_id uuid REFERENCES public.battalions(id) ON DELETE SET NULL,
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Recitations
CREATE TABLE public.recitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  recited_on date NOT NULL DEFAULT CURRENT_DATE,
  surah text NOT NULL,
  from_ayah int NOT NULL CHECK (from_ayah >= 1),
  to_ayah int NOT NULL CHECK (to_ayah >= 1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read recitations" ON public.recitations FOR SELECT USING (true);
CREATE POLICY "Public insert recitations" ON public.recitations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update recitations" ON public.recitations FOR UPDATE USING (true);
CREATE POLICY "Public delete recitations" ON public.recitations FOR DELETE USING (true);

CREATE TRIGGER trg_recitations_updated_at
BEFORE UPDATE ON public.recitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_recitations_student ON public.recitations(student_id, recited_on DESC);
CREATE INDEX idx_companies_battalion ON public.companies(battalion_id);
CREATE INDEX idx_students_battalion ON public.students(battalion_id);
CREATE INDEX idx_students_company ON public.students(company_id);
