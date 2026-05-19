
-- Restrict all public policies to authenticated users
-- Students
DROP POLICY IF EXISTS "Public read students" ON public.students;
DROP POLICY IF EXISTS "Public insert students" ON public.students;
DROP POLICY IF EXISTS "Public update students" ON public.students;
DROP POLICY IF EXISTS "Public delete students" ON public.students;
CREATE POLICY "Authenticated read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update students" ON public.students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete students" ON public.students FOR DELETE TO authenticated USING (true);

-- Attendance
DROP POLICY IF EXISTS "Public read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public delete attendance" ON public.attendance;
CREATE POLICY "Authenticated read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update attendance" ON public.attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete attendance" ON public.attendance FOR DELETE TO authenticated USING (true);

-- Recitations
DROP POLICY IF EXISTS "Public read recitations" ON public.recitations;
DROP POLICY IF EXISTS "Public insert recitations" ON public.recitations;
DROP POLICY IF EXISTS "Public update recitations" ON public.recitations;
DROP POLICY IF EXISTS "Public delete recitations" ON public.recitations;
CREATE POLICY "Authenticated read recitations" ON public.recitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert recitations" ON public.recitations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update recitations" ON public.recitations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete recitations" ON public.recitations FOR DELETE TO authenticated USING (true);

-- Battalions
DROP POLICY IF EXISTS "Public read battalions" ON public.battalions;
DROP POLICY IF EXISTS "Public insert battalions" ON public.battalions;
DROP POLICY IF EXISTS "Public update battalions" ON public.battalions;
DROP POLICY IF EXISTS "Public delete battalions" ON public.battalions;
CREATE POLICY "Authenticated read battalions" ON public.battalions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert battalions" ON public.battalions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update battalions" ON public.battalions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete battalions" ON public.battalions FOR DELETE TO authenticated USING (true);

-- Companies
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
DROP POLICY IF EXISTS "Public insert companies" ON public.companies;
DROP POLICY IF EXISTS "Public update companies" ON public.companies;
DROP POLICY IF EXISTS "Public delete companies" ON public.companies;
CREATE POLICY "Authenticated read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete companies" ON public.companies FOR DELETE TO authenticated USING (true);
