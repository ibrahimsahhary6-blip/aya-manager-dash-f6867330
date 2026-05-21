
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- No INSERT/UPDATE/DELETE policies: writes happen exclusively via SECURITY DEFINER triggers.

-- Helper to look up current actor email
CREATE OR REPLACE FUNCTION public.current_actor_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Trigger: profiles approval changes
CREATE OR REPLACE FUNCTION public.log_profile_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_user_id, target_email, metadata)
    VALUES (
      auth.uid(),
      public.current_actor_email(),
      CASE WHEN NEW.is_approved THEN 'user_approved' ELSE 'user_unapproved' END,
      NEW.user_id,
      NEW.email,
      jsonb_build_object('approved_at', NEW.approved_at)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_profile_approval ON public.profiles;
CREATE TRIGGER trg_log_profile_approval
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_approval();

-- Trigger: allowed_emails insert/delete
CREATE OR REPLACE FUNCTION public.log_allowed_emails()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_email, metadata)
    VALUES (auth.uid(), public.current_actor_email(), 'email_invited', NEW.email,
      jsonb_build_object('notes', NEW.notes));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_email)
    VALUES (auth.uid(), public.current_actor_email(), 'email_removed', OLD.email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_allowed_emails ON public.allowed_emails;
CREATE TRIGGER trg_log_allowed_emails
AFTER INSERT OR DELETE ON public.allowed_emails
FOR EACH ROW EXECUTE FUNCTION public.log_allowed_emails();

-- Trigger: user_roles changes
CREATE OR REPLACE FUNCTION public.log_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO t_email FROM public.profiles WHERE user_id = NEW.user_id;
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_user_id, target_email, metadata)
    VALUES (auth.uid(), public.current_actor_email(), 'role_granted', NEW.user_id, t_email,
      jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO t_email FROM public.profiles WHERE user_id = OLD.user_id;
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_user_id, target_email, metadata)
    VALUES (auth.uid(), public.current_actor_email(), 'role_revoked', OLD.user_id, t_email,
      jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_roles ON public.user_roles;
CREATE TRIGGER trg_log_user_roles
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_user_roles();

-- Allow super_admin to manage roles (existing policy only allows admin role)
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
