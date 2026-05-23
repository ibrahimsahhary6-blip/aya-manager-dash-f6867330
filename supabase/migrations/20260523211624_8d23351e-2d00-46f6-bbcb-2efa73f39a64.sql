
-- 1) BACKUPS: restrict read/insert to admins
DROP POLICY IF EXISTS "Authenticated read backups" ON public.backups;
DROP POLICY IF EXISTS "Authenticated insert backups" ON public.backups;
CREATE POLICY "Admins read backups" ON public.backups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins insert backups" ON public.backups
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 2) BATTALIONS: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated insert battalions" ON public.battalions;
DROP POLICY IF EXISTS "Authenticated update battalions" ON public.battalions;
DROP POLICY IF EXISTS "Authenticated delete battalions" ON public.battalions;
CREATE POLICY "Admins insert battalions" ON public.battalions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update battalions" ON public.battalions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete battalions" ON public.battalions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 3) COMPANIES: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated delete companies" ON public.companies;
CREATE POLICY "Admins insert companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 4) STUDENTS: restrict insert/update to admins
DROP POLICY IF EXISTS "Authenticated insert students" ON public.students;
DROP POLICY IF EXISTS "Authenticated update students" ON public.students;
CREATE POLICY "Admins insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update students" ON public.students
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 5) RECITATIONS: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated insert recitations" ON public.recitations;
DROP POLICY IF EXISTS "Authenticated update recitations" ON public.recitations;
DROP POLICY IF EXISTS "Authenticated delete recitations" ON public.recitations;
CREATE POLICY "Admins insert recitations" ON public.recitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update recitations" ON public.recitations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete recitations" ON public.recitations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 6) ATTENDANCE: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated delete attendance" ON public.attendance;
CREATE POLICY "Admins insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 7) USER_ROLES: prevent admins from granting super_admin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage non-super roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND role <> 'super_admin'::app_role)
  WITH CHECK (public.has_role(auth.uid(),'admin') AND role <> 'super_admin'::app_role);
