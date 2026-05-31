
-- Recitations: allow all authenticated users full CRUD
DROP POLICY IF EXISTS "Admins insert recitations" ON public.recitations;
DROP POLICY IF EXISTS "Admins update recitations" ON public.recitations;
DROP POLICY IF EXISTS "Admins delete recitations" ON public.recitations;

CREATE POLICY "Authenticated insert recitations"
ON public.recitations FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update recitations"
ON public.recitations FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete recitations"
ON public.recitations FOR DELETE TO authenticated
USING (true);

-- Attendance: allow all authenticated users full CRUD
DROP POLICY IF EXISTS "Admins insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins delete attendance" ON public.attendance;

CREATE POLICY "Authenticated insert attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete attendance"
ON public.attendance FOR DELETE TO authenticated
USING (true);
