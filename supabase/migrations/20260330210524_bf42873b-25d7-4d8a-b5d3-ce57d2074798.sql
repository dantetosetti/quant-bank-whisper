-- Tighten INSERT/UPDATE policies to service_role only
DROP POLICY "Service role can insert UBPR cache" ON public.ubpr_cache;
DROP POLICY "Service role can update UBPR cache" ON public.ubpr_cache;

-- Only service_role (edge functions) can insert
CREATE POLICY "Service role can insert UBPR cache"
  ON public.ubpr_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role can update
CREATE POLICY "Service role can update UBPR cache"
  ON public.ubpr_cache FOR UPDATE
  TO service_role
  USING (true);