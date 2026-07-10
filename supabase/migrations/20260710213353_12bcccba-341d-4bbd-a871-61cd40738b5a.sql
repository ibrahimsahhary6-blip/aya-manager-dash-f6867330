CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
  is_service boolean := current_setting('role', true) = 'service_role'
                     OR current_user = 'service_role'
                     OR session_user = 'service_role';
BEGIN
  -- user_id is immutable for everyone
  NEW.user_id := OLD.user_id;

  IF NOT (is_super OR is_service) THEN
    NEW.email := OLD.email;
  END IF;

  IF NOT (is_admin OR is_super OR is_service) THEN
    NEW.is_approved := OLD.is_approved;
    NEW.approved_at := OLD.approved_at;
  END IF;

  RETURN NEW;
END;
$function$;