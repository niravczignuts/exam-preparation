import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadResult {
  upload_id: string;
  file_name: string;
  parse_status: "completed" | "failed";
  question_count: number;
  error: string | null;
}

export function PyqUpload({ onUploaded }: { onUploaded: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [examYear, setExamYear] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (files.length === 0) return;

    setStatus("uploading");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Not signed in");
      setStatus("idle");
      return;
    }

    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    if (examYear) formData.append("exam_year", examYear);

    try {
      const response = await fetch(`${base}/pyq/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Upload failed (${response.status})`);
      }
      const { results } = (await response.json()) as { results: UploadResult[] };
      const totalQuestions = results.reduce((sum, r) => sum + r.question_count, 0);
      const failed = results.filter((r) => r.parse_status === "failed");

      if (failed.length > 0) {
        toast.error(`${failed.length} file(s) failed to parse: ${failed[0].error}`);
      }
      if (totalQuestions > 0) {
        toast.success(`Added ${totalQuestions} question(s) to your Q&A bank`);
      }
      onUploaded();
      setFiles([]);
      setExamYear("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label
            htmlFor="pyq-upload"
            className="hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl px-5 py-6 text-center transition-colors"
          >
            {status === "uploading" ? (
              <Loader2Icon className="text-primary size-6 animate-spin" />
            ) : (
              <UploadCloudIcon className="text-muted-foreground size-6" />
            )}
            <span className="text-sm font-medium">
              {status === "uploading"
                ? "Parsing your papers…"
                : files.length > 0
                  ? `${files.length} file(s) selected`
                  : "Upload PYQ papers (PDF, DOCX, or image) — multiple files supported"}
            </span>
            <span className="text-muted-foreground text-xs">
              Auto-parsed into questions with generated answers &amp; explanations
            </span>
            <input
              id="pyq-upload"
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,image/*"
              multiple
              onChange={handleFileChange}
              disabled={status === "uploading"}
              className="sr-only"
            />
          </label>

          <div className="flex items-end gap-2 px-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-year" className="text-xs">
                Exam year (optional)
              </Label>
              <Input
                id="exam-year"
                type="number"
                placeholder="2023"
                value={examYear}
                onChange={(e) => setExamYear(e.target.value)}
                className="h-9 w-28"
              />
            </div>
            <Button type="submit" size="sm" disabled={files.length === 0 || status === "uploading"}>
              Upload
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
