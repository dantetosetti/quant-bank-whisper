import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface UploadedFile {
  name: string;
  storagePath: string;
  size: number;
  status: "uploaded" | "processing" | "done" | "error";
  result?: { totalRecords?: number; inserted?: number; errors?: number };
  error?: string;
}

const AdminUpload = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleFiles = useCallback(async (fileList: FileList) => {
    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      const storagePath = `bulk-uploads/${Date.now()}-${file.name}`;

      try {
        const { error } = await supabase.storage
          .from("ubpr-reports")
          .upload(storagePath, file, { contentType: "application/xml", upsert: true });

        if (error) throw error;

        newFiles.push({
          name: file.name,
          storagePath,
          size: file.size,
          status: "uploaded",
        });
      } catch (err: any) {
        newFiles.push({
          name: file.name,
          storagePath,
          size: file.size,
          status: "error",
          error: err.message || "Upload failed",
        });
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);
    setUploading(false);

    const successCount = newFiles.filter((f) => f.status === "uploaded").length;
    if (successCount > 0) {
      toast({ title: `${successCount} file(s) uploaded`, description: "Ready to process into database." });
    }
  }, [toast]);

  const processFile = async (index: number) => {
    const file = files[index];
    if (!file || file.status !== "uploaded") return;

    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: "processing" } : f)));

    try {
      const { data, error } = await supabase.functions.invoke("process-bulk-ubpr", {
        body: { storagePath: file.storagePath },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Processing failed");

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "done", result: data } : f
        )
      );

      toast({
        title: "Processing complete",
        description: `${data.inserted} bank records inserted from ${file.name}`,
      });
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: err.message } : f
        )
      );
    }
  };

  const processAll = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "uploaded") {
        await processFile(i);
      }
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const uploadedCount = files.filter((f) => f.status === "uploaded").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-brand text-lg hover:opacity-80 transition-opacity">
              <span className="text-primary">Peer</span><span className="text-accent">Sweep</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">Admin: Bulk Data Upload</span>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="container max-w-2xl py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload UBPR Bulk XBRL Files
            </CardTitle>
            <CardDescription>
              Upload XBRL files from the FFIEC CDR Bulk Data Download. Each file will be parsed
              and all bank records inserted into the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ".xml,.xbrl";
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files?.length) handleFiles(target.files);
                };
                input.click();
              }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Drop XBRL files here or click to browse</p>
                  <p className="text-xs text-muted-foreground">.xml or .xbrl files from FFIEC CDR</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {files.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Files ({files.length})</CardTitle>
              {uploadedCount > 0 && (
                <Button size="sm" onClick={processAll}>
                  Process All ({uploadedCount})
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                      {file.result && ` • ${file.result.inserted} records inserted`}
                      {file.error && ` • ${file.error}`}
                    </p>
                  </div>
                  {file.status === "uploaded" && (
                    <Button size="sm" variant="outline" onClick={() => processFile(i)}>
                      Process
                    </Button>
                  )}
                  {file.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {file.status === "done" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {file.status === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminUpload;
