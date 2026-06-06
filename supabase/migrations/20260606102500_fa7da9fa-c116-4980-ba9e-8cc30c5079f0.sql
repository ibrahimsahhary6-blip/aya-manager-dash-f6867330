
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.recitations ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- Allow owners to delete their own record within 24h
CREATE POLICY "Owners delete own attendance within 24h" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    is_approved_user()
    AND created_by = auth.uid()
    AND created_at > (now() - interval '24 hours')
  );

CREATE POLICY "Owners delete own recitations within 24h" ON public.recitations
  FOR DELETE TO authenticated
  USING (
    is_approved_user()
    AND created_by = auth.uid()
    AND created_at > (now() - interval '24 hours')
  );
