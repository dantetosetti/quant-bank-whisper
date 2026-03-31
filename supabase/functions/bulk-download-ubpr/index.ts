import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportDate } = await req.json();
    // reportDate e.g. "12/31/2024" or "03/31/2024"

    if (!reportDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'reportDate is required (e.g. "12/31/2024")' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting TinyFish bulk UBPR download for report date: ${reportDate}`);

    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/PWS/DownloadBulkData.aspx',
        goal: `On this FFIEC CDR Bulk Data Download page, I need to download the UBPR bulk data file:

1. Look for a dropdown or selection for "Products" or report type. Select "UBPR" (Uniform Bank Performance Report).
2. Look for a dropdown to select the report period/date. Select "${reportDate}" or the closest available date.
3. Look for a file format option. If available, select "XBRL" format.
4. Click the "Download" button to start the download.
5. Return the direct download URL of the file as JSON: {"downloadUrl": "https://..."}

If there is no direct download URL visible, return the URL that the download button navigates to. If a file downloads directly, describe what happened and provide any URL you can capture.`,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error('TinyFish bulk download start error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TinyFish API error: ${tinyFishResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    console.log('TinyFish response:', JSON.stringify(tinyFishResult));
    const runId = tinyFishResult?.run_id;

    if (!runId) {
      console.error('TinyFish did not return a run_id:', JSON.stringify(tinyFishResult));
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish did not return a run ID', details: tinyFishResult }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Track the job
    const { data: job, error: jobError } = await supabase
      .from('ffiec_report_jobs')
      .insert({
        rssd: 'BULK',
        bank_name: 'All Banks - Bulk Download',
        report_type: 'ubpr_bulk',
        status: 'processing',
        source: 'live',
        tinyfish_run_id: runId,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Bulk download job insert error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create bulk download job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Started TinyFish bulk download run ${runId}, job ${job.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        source: 'live',
        status: 'processing',
        jobId: job.id,
        reportDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error starting bulk UBPR download:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
