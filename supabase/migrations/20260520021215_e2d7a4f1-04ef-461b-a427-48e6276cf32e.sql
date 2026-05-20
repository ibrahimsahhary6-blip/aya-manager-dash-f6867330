CREATE TABLE public.backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('manual','daily','pre_delete')),
  payload jsonb NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backups_created_at ON public.backups (created_at DESC);
CREATE INDEX idx_backups_kind ON public.backups (kind);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read backups"
  ON public.backups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert backups"
  ON public.backups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin delete backups"
  ON public.backups FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));