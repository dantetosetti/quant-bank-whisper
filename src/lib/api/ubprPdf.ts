import { supabase } from '@/integrations/supabase/client';

export interface UBPRPdfData {
  report_date: string;
  metrics: Record<string, number | string>;
}

/**
 * Fetch UBPR data for a bank from the database (up to 5 most recent quarters).
 */
export const fetchUBPRData = async (rssd: string): Promise<UBPRPdfData[]> => {
  const { data, error } = await supabase
    .from('ubpr_data')
    .select('report_date, metrics')
    .eq('rssd', rssd)
    .order('report_date', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Failed to fetch UBPR data: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No UBPR data found for this bank. Upload data first via Admin Upload.');
  }

  return data.map((row) => ({
    report_date: row.report_date,
    metrics: row.metrics as Record<string, number | string>,
  }));
};
