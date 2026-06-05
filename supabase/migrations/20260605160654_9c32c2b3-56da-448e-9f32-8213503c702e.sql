
-- 1) Prevent privilege escalation via profiles self-update
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.user_id
     AND NOT (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    NEW.is_approved := OLD.is_approved;
    NEW.approved_at := OLD.approved_at;
    NEW.email       := OLD.email;
    NEW.user_id     := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

-- 2) Allow public submission of access requests (status must be 'pending')
DROP POLICY IF EXISTS "Anyone can submit access request" ON public.access_requests;
CREATE POLICY "Anyone can submit access request"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

GRANT INSERT ON public.access_requests TO anon, authenticated;
