ALTER TABLE public.recitations ADD COLUMN IF NOT EXISTS rating TEXT;
ALTER TABLE public.recitations DROP CONSTRAINT IF EXISTS recitations_rating_check;
ALTER TABLE public.recitations ADD CONSTRAINT recitations_rating_check CHECK (rating IS NULL OR rating IN ('8','9','10','repeat'));