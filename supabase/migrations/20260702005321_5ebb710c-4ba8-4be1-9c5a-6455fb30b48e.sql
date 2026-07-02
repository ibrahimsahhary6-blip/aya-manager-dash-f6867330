CREATE POLICY "Users can check their own email in allowlist"
ON public.allowed_emails
FOR SELECT
TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')));