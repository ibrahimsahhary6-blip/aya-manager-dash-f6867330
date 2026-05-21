
-- Restore super_admin to original email
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role FROM public.profiles
WHERE lower(email) = lower('ibrahim.sahhary@gmail.com')
ON CONFLICT DO NOTHING;

-- Ensure approved
UPDATE public.profiles SET is_approved = true, approved_at = COALESCE(approved_at, now())
WHERE lower(email) = lower('ibrahim.sahhary@gmail.com');

-- Remove super_admin from the wrong account (keep admin)
DELETE FROM public.user_roles
WHERE role = 'super_admin'
  AND user_id = (SELECT user_id FROM public.profiles WHERE lower(email) = lower('ibrahim.sahhary6@gmail.com'));
