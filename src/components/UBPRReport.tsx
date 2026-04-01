import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, AlertTriangle } from "lucide-react";
import { fetchUBPRData } from "@/lib/api/ubprPdf";
import { generateUBPRPdf } from "@/lib/generateUBPRPdf";
import { useToast } from "@/hooks/use-toast";

interface UBPRReportProps {
  bankName: string;
  rssd?: string;
}

const UBPRReport = ({ bankName, rssd }: UBPRReportProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!rssd) return;
    setIsLoading(true);
    setError(null);

    try {
      const quarters = await fetchUBPRData(rssd);
      const blob = await generateUBPRPdf(bankName, rssd, quarters);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      toast({ title: "Report Generated", description: `UBPR PDF for ${bankName} is ready.` });
    } catch (err) {
      console.error("Failed to generate UBPR PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to generate UBPR report.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `UBPR_${bankName.replace(/\s+/g, "_")}_${rssd}.pdf`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">FFIEC Reports</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Uniform Bank Performance Report</p>
      </div>

      {!pdfUrl && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-12 w-12 text-primary/60" />
            <div>
              <h4 className="font-semibold text-foreground">UBPR Facsimile Report</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a UBPR report from uploaded data showing the most recent 5 quarters.
              </p>
            </div>

            <Button onClick={handleGenerate} disabled={isLoading || !rssd} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating report…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate UBPR Report
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 w-full">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-left">{error}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {pdfUrl && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <span className="text-sm font-medium text-muted-foreground">FFIEC UBPR Facsimile</span>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
              <Download className="h-3 w-3" />
              Download PDF
            </Button>
          </div>
          <iframe src={pdfUrl} className="w-full h-[700px] border-0" title={`UBPR Report for ${bankName}`} />
        </Card>
      )}
    </div>
  );
};

export default UBPRReport;
