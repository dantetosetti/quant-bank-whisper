

## Plan: Fix Market Intel Data Parsing

### Problem
The `result_metrics` column in `ffiec_report_jobs` for market intel jobs stores data like:
```json
{ "result": "```json\n{ \"peerBankRates\": [...], ... }\n```" }
```

The edge function returns `existingJob.result_metrics` directly as `data`, but the client (`MarketResearch.tsx`) expects `data.peerBankRates`, `data.localNews`, `data.socialMedia` at the top level. The nested `result` key with markdown code fences means none of those properties exist.

### Fix

**Update `supabase/functions/fetch-market-intel/index.ts`** — add a parsing step when returning cached data:

1. When returning from cache, extract `result_metrics.result`
2. Strip the markdown code fences (`` ```json `` and `` ``` ``)
3. Parse the inner JSON string
4. Return the parsed object as `data`

This same parsing should also be applied in the `process-bulk-ubpr` or `ffiec-job-status` path for when jobs complete via polling (the `pollFFIECJob` path).

**Also update `src/lib/api/marketIntel.ts`** — add a defensive parsing fallback on the client side:

1. After receiving `data.data`, check if it has a `result` key that's a string
2. If so, strip code fences and parse it
3. Return the cleaned object

This ensures both cached and polled results work correctly.

### Files Changed
- `supabase/functions/fetch-market-intel/index.ts` — parse `result_metrics` before returning cache hit
- `src/lib/api/marketIntel.ts` — add defensive client-side parsing

### Technical Detail

```typescript
// Parsing helper for the edge function
function parseMarketIntelResult(raw: any): any {
  if (!raw) return raw;
  if (raw.peerBankRates || raw.localNews || raw.socialMedia) return raw;
  if (typeof raw.result === 'string') {
    const cleaned = raw.result.replace(/^```json\s*/i, '').replace(/\s*```$/,'');
    try { return JSON.parse(cleaned); } catch { return raw; }
  }
  return raw;
}
```

### Result
Clicking "Current Market Intelligence" will display the peer bank rates table, local news cards, and social media activity — all the data that's already in the database.

