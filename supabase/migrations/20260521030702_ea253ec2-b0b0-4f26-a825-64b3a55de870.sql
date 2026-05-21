
-- Allowed emails table
CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage allowed_emails"
ON public.allowed_emails FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Profiles: track first login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_login_notified boolean NOT NULL DEFAULT false;

-- Allow user to update their own first_login_at
CREATE POLICY "Users update own first login"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Update new-user trigger: auto-approve only if email is in allowed_emails
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first boolean;
  is_allowed boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  SELECT EXISTS (SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email))
    INTO is_allowed;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (user_id, email, is_approved, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    is_first OR is_allowed,
    CASE WHEN is_first OR is_allowed THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
