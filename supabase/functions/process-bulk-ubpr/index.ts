import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedBank {
  rssd: string;
  reportDate: string;
  metrics: Record<string, number | string>;
  sourceConcepts: Record<string, number | string>;
}

function parseXBRL(xmlContent: string): ParsedBank[] {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  if (!doc) return [];

  const banks: Map<string, ParsedBank> = new Map();

  // Extract context info to map context IDs to RSSD + date
  const contexts = doc.querySelectorAll('context');
  const contextMap: Map<string, { rssd: string; date: string }> = new Map();

  for (const ctx of contexts) {
    const id = ctx.getAttribute('id') || '';
    const identifier = ctx.querySelector('identifier');
    const instant = ctx.querySelector('instant');
    const endDate = ctx.querySelector('endDate');

    if (identifier) {
      const rssd = identifier.textContent?.trim() || '';
      const date = instant?.textContent?.trim() || endDate?.textContent?.trim() || '';
      if (rssd && date) {
        contextMap.set(id, { rssd, date });
      }
    }
  }

  // Parse all UBPR and source concept elements
  const allElements = doc.documentElement?.children || [];
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const tagName = el.tagName || '';
    const contextRef = el.getAttribute('contextRef') || '';
    const value = el.textContent?.trim() || '';

    if (!contextRef || !value) continue;

    const ctxInfo = contextMap.get(contextRef);
    if (!ctxInfo) continue;

    const key = `${ctxInfo.rssd}_${ctxInfo.date}`;
    if (!banks.has(key)) {
      banks.set(key, {
        rssd: ctxInfo.rssd,
        reportDate: ctxInfo.date,
        metrics: {},
        sourceConcepts: {},
      });
    }

    const bank = banks.get(key)!;

    // Extract concept name from tag (e.g., "uc:UBPR4635" -> "UBPR4635", "cc:RCON2170" -> "RCON2170")
    const conceptName = tagName.includes(':') ? tagName.split(':')[1] : tagName;

    if (!conceptName) continue;

    // Skip non-data elements
    if (['schemaRef', 'context', 'unit'].some(skip => tagName.includes(skip))) continue;

    const unitRef = el.getAttribute('unitRef') || '';
    let parsedValue: number | string = value;
    if (unitRef === 'USD' || unitRef === 'PURE') {
      const num = parseFloat(value);
      if (!isNaN(num)) parsedValue = num;
    }

    // Separate UBPR metrics from source concepts (RCON, RIAD)
    if (conceptName.startsWith('UBPR')) {
      bank.metrics[conceptName] = parsedValue;
    } else if (conceptName.startsWith('RCON') || conceptName.startsWith('RIAD')) {
      bank.sourceConcepts[conceptName] = parsedValue;
    }
  }

  return Array.from(banks.values());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { downloadUrl, jobId } = await req.json();

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'downloadUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Downloading bulk UBPR from: ${downloadUrl}`);

    // Download the file
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download: ${downloadResponse.status}`);
    }

    const contentType = downloadResponse.headers.get('content-type') || '';
    const content = await downloadResponse.text();

    console.log(`Downloaded content (${content.length} chars), type: ${contentType}`);

    // Parse the XBRL content
    // If it's a single XBRL file, parse directly
    // If it's a zip, we'd need to handle that differently
    let allBanks: ParsedBank[] = [];

    if (content.includes('<?xml') || content.includes('<xbrl')) {
      allBanks = parseXBRL(content);
      console.log(`Parsed ${allBanks.length} bank-period records from XBRL`);
    } else {
      console.log('Content does not appear to be XBRL. First 500 chars:', content.substring(0, 500));
      throw new Error('Downloaded content is not in XBRL format. It may be a zip file that needs different handling.');
    }

    // Batch upsert into ubpr_data
    let inserted = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < allBanks.length; i += batchSize) {
      const batch = allBanks.slice(i, i + batchSize).map((b) => ({
        rssd: b.rssd,
        report_date: b.reportDate,
        metrics: b.metrics,
        source_concepts: b.sourceConcepts,
      }));

      const { error } = await supabase.from('ubpr_data').upsert(batch, {
        onConflict: 'rssd,report_date',
      });

      if (error) {
        console.error(`Batch upsert error at offset ${i}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Bulk import complete: ${inserted} records inserted, ${errors} errors`);

    // Update job status if jobId provided
    if (jobId) {
      await supabase
        .from('ffiec_report_jobs')
        .update({
          status: errors === 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
          result_metrics: { totalRecords: allBanks.length, inserted, errors },
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalRecords: allBanks.length,
        inserted,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error processing bulk UBPR:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
