
DROP POLICY IF EXISTS "Users read own profile or admin reads all" ON public.profiles;
CREATE POLICY "Users read own profile or admin reads all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );
