import { supabase } from '@/integrations/supabase/client';
import { pollFFIECJob, type FFIECJobStatusResponse } from '@/lib/api/ffiecJobs';

interface PeerGroupReportResponse {
  success: boolean;
  error?: string;
  pdfUrl?: string | null;
  ffiecUrl?: string;
  message?: string;
  status?: string;
  jobId?: string;
}

export const fetchPeerGroupReport = async (
  subjectRssd: string,
  subjectName: string,
  peerRssds: string[],
  peerNames: string[],
  onStreamingUrl?: (url: string) => void,
): Promise<FFIECJobStatusResponse> => {
  const { data, error } = await supabase.functions.invoke<PeerGroupReportResponse>('fetch-peer-group-report', {
    body: { subjectRssd, subjectName, peerRssds, peerNames },
  });

  if (error) {
    throw new Error(`Failed to start Custom Peer Group Report: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to start Custom Peer Group Report');
  }

  if (data.status === 'processing' && data.jobId) {
    const finalJob = await pollFFIECJob(data.jobId, onStreamingUrl);

    if (finalJob.status === 'failed') {
      throw new Error(finalJob.error || 'Failed to generate Custom Peer Group Report');
    }

    return finalJob;
  }

  return data as FFIECJobStatusResponse;
};
