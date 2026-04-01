
Goal: remove the Chrome blocked-page message by eliminating the embedded PDF iframe entirely.

What I found
- The message is not app text; it is coming from Chrome’s built-in PDF/document handling.
- `src/components/UBPRReport.tsx` currently does this:
  - generates a PDF data URI
  - stores it in `pdfUrl`
  - embeds it with `<iframe src={pdfUrl} />`
- `src/lib/generateUBPRPdf.ts` returns `doc.output('datauristring')`, which is exactly the kind of iframe source Chrome may block in embedded contexts.

Recommended fix
1. Replace the iframe preview with an in-app UBPR facsimile renderer
- Build the report as styled HTML inside `UBPRReport.tsx` (or a new presentational component like `UBPRReportPreview.tsx`)
- Reuse the existing `ubprConceptMap.ts` section structure and the same 5-quarter dataset
- Show the report immediately when the user opens “Subject Bank FFIEC Report”
- This fully removes the Chrome warning because there is no embedded PDF viewer anymore

2. Keep PDF generation separate and optional
- Keep `generateUBPRPdf.ts` for actual downloads/export only
- Do not auto-open or auto-embed the PDF
- If desired, leave a small “Download PDF” action, but not required for viewing

3. Refactor report state in `UBPRReport.tsx`
- Fetch UBPR data on mount as it does now
- Store parsed quarter data rather than `pdfUrl`
- Render:
  - loading state
  - error state
  - HTML report preview state

4. Match the current report structure visually
- Add a branded report header
- Render one section at a time using cards/tables
- Show quarter columns across the top
- Format dollars/ratios exactly as the PDF generator already does
- If needed, paginate visually with multiple stacked cards instead of actual PDF pages

Technical details
- Files to update:
  - `src/components/UBPRReport.tsx`
  - likely add `src/components/UBPRReportPreview.tsx`
  - optionally extract shared formatting helpers from `src/lib/generateUBPRPdf.ts`
- Keep:
  - `src/lib/api/ubprPdf.ts` for data fetch
  - `src/lib/ubprConceptMap.ts` for section/label mapping
- Stop using:
  - `<iframe src={pdfUrl} ... />`
  - `doc.output('datauristring')` as a preview mechanism

Why this is the right fix
- The blocked-page banner is a browser behavior, not a simple text label we can hide
- As long as the app embeds the generated PDF inside an iframe/data URI flow, Chrome may still show that warning
- Rendering the report natively in React removes the root cause instead of masking it

Expected result
- Clicking “Subject Bank FFIEC Report” opens the report directly in the app
- No second click required
- No Chrome blocked-page message
- Optional PDF export can still exist without affecting the on-screen experience
