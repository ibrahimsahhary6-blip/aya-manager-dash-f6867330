CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attended_on DATE NOT NULL DEFAULT CURRENT_DATE,
  present BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attended_on)
);

CREATE INDEX idx_attendance_date ON public.attendance(attended_on);
CREATE INDEX idx_attendance_student ON public.attendance(student_id);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Public insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Public delete attendance" ON public.attendance FOR DELETE USING (true);

CREATE TRIGGER set_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();