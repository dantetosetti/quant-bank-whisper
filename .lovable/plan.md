

## Plan: Generate UBPR PDF Report from Database Data

### Overview
Replace the current TinyFish/FFIEC website scraping approach with a PDF generator that pulls UBPR data from the `ubpr_data` table and renders a professional report styled like the official FFIEC UBPR facsimile.

### Architecture

```text
Browser (click "Generate Report")
  → Edge Function: generate-ubpr-pdf
    → Query ubpr_data for bank + last 5 quarters
    → Map UBPR concept codes to report line items
    → Generate PDF using jsPDF or similar
    → Upload PDF to Storage (ubpr-reports bucket)
    → Return PDF URL
  → Browser embeds/downloads PDF
```

### Changes

**1. New Edge Function: `generate-ubpr-pdf`**
- Accepts `{ rssd, bankName }` 
- Queries `ubpr_data` for all report dates for that RSSD, selects the most recent 5 quarters
- Maps ~107 UBPR concept codes to human-readable line items organized into standard UBPR report sections:
  - **Summary Ratios** (Earnings, Liquidity, Capitalization, Asset Quality)
  - **Income Statement** (Interest Income, Interest Expense, Noninterest Income/Expense, Net Income)
  - **Balance Sheet** (Assets, Liabilities, Capital)
- Formats values: dollar amounts in thousands with commas, ratios as percentages
- Generates a multi-page PDF with tables showing 5 quarters side-by-side
- Stores the PDF in the `ubpr-reports` storage bucket
- Returns the public URL

**2. New file: `src/lib/ubprConceptMap.ts`**
- A mapping of UBPR concept codes (e.g., `UBPRD660` = "Return on Average Assets", `UBPRD653` = "Net Interest Margin") to:
  - Human-readable label
  - Report section
  - Display format (dollar amount vs. ratio/percentage)
  - Sort order within section

**3. Update `UBPRReport.tsx`**
- Replace TinyFish-based fetching with a call to the new `generate-ubpr-pdf` edge function
- Remove references to TinyFish streaming URLs and live progress messaging
- Keep the existing PDF viewer component for displaying the result
- Update loading text to "Generating report from database..."

**4. Update `src/lib/api/ubprPdf.ts`**
- Simplify to call `generate-ubpr-pdf` instead of `fetch-ubpr-pdf`
- Remove the job polling logic (PDF generation will be synchronous, not async)
- Return the PDF URL directly

### UBPR Concept Code Mapping (Key Fields)
Based on the data in the database, the main mappings include:

| Code | Label | Format |
|------|-------|--------|
| UBPRD660 | Return on Average Assets | % (needs division) |
| UBPRD661 | Return on Average Equity | % |
| UBPRD653 | Net Interest Margin | % |
| UBPRE119 | Efficiency Ratio | % |
| UBPR2170 | Tier 1 Capital | $ |
| UBPRD672 | Noncurrent Loans | $ |
| UBPR0071 | Total Assets | $ |
| UBPRB528 | Total Loans & Leases | $ |
| UBPRD662 | Average Assets | $ |

Note: The stored values appear to be raw numbers (in units, not thousands). The PDF generator will need to divide by 1000 for display in thousands.

### What gets removed
- The `fetch-ubpr-pdf` edge function (TinyFish-based) becomes unused
- Job polling for PDF retrieval in `ubprPdf.ts`
- TinyFish streaming URL references in the UI

### Result
Clicking "Retrieve UBPR Report" generates a clean, formatted PDF from database data in seconds — no FFIEC website navigation, no TinyFish dependency, no multi-minute waits.

