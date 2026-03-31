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
    const { subjectRssd, subjectName, peerRssds, peerNames } = await req.json();

    if (!subjectRssd || !peerRssds || !Array.isArray(peerRssds) || peerRssds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subject RSSD and at least one peer RSSD are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const peerList = peerRssds.map((rssd: string, i: number) => {
      const name = peerNames?.[i] || `Bank ${rssd}`;
      return `- RSSD: ${rssd} (${name})`;
    }).join('\n');

    console.log(`Starting Custom Peer Group Report for ${subjectName} (RSSD ${subjectRssd}) with ${peerRssds.length} peers`);

    const goal = `On the FFIEC CDR website at https://cdr.ffiec.gov/public/ManageFacsimiles.aspx, I need to generate a Custom Peer Group Bank Report PDF:

1. Navigate to https://cdr.ffiec.gov/public/ManageFacsimiles.aspx
2. In the institution search, enter RSSD ID: ${subjectRssd} and search for "${subjectName}"
3. Select the institution from the results
4. Look for a "Custom Peer Group" option or "UBPR" report type
5. Select "Custom Peer Group" as the report type
6. For the peer group, I need to add the following banks by their RSSD IDs:
${peerList}
7. Enter each peer bank RSSD one at a time into the peer group builder/search and add them
8. Select the most recent reporting period available
9. Generate/download the Custom Peer Group report as a PDF
10. Return the final PDF URL or download URL as JSON: {"pdfUrl": "https://..."}

If you encounter a "Build Custom Peer Group" or similar button, click it and add each peer bank.
If you cannot extract a direct PDF URL, return {"error": "Could not generate custom peer group report"}.`;

    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/ManageFacsimiles.aspx',
        goal,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error('TinyFish async start error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TinyFish API error: ${tinyFishResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    const runId = tinyFishResult?.run_id;

    if (!runId) {
      console.error('TinyFish did not return a run_id:', tinyFishResult);
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish did not return a run ID' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('ffiec_report_jobs')
      .insert({
        rssd: subjectRssd,
        bank_name: subjectName,
        report_type: 'custom_peer_group',
        status: 'processing',
        source: 'live',
        tinyfish_run_id: runId,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Job insert error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create report job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Started TinyFish run ${runId} for Custom Peer Group Report, job ${job.id}`);

    return new Response(
      JSON.stringify({ success: true, source: 'live', status: 'processing', jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error starting Custom Peer Group Report:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
