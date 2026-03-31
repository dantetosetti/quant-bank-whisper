
CREATE TABLE public.ubpr_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rssd text NOT NULL,
  report_date text NOT NULL,
  bank_name text,
  metrics jsonb NOT NULL DEFAULT '{}',
  source_concepts jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rssd, report_date)
);

ALTER TABLE public.ubpr_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read UBPR data"
  ON public.ubpr_data FOR SELECT TO public USING (true);

CREATE POLICY "Service role can insert UBPR data"
  ON public.ubpr_data FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update UBPR data"
  ON public.ubpr_data FOR UPDATE TO service_role USING (true);

CREATE INDEX idx_ubpr_data_rssd ON public.ubpr_data(rssd);
CREATE INDEX idx_ubpr_data_report_date ON public.ubpr_data(report_date);
