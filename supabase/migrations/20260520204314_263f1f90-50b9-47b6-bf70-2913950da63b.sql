
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS rating text;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_rating_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_rating_check
  CHECK (rating IS NULL OR rating IN ('8','9','10','repeat'));
