import { useRef, useState, type ChangeEvent } from "react";
import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";

export function SyllabusUpload({ onUploaded }: { onUploaded: () => void }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setStatus("error");
      setError("Not signed in");
      return;
    }

    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${base}/syllabus/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Upload failed (${response.status})`);
      }
      setStatus("idle");
      toast.success("Syllabus parsed and added");
      onUploaded();
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="border-dashed py-0">
      <CardContent className="px-0">
        <label
          htmlFor="syllabus-upload"
          className="hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl px-5 py-8 text-center transition-colors"
        >
          {status === "uploading" ? (
            <Loader2Icon className="text-primary size-6 animate-spin" />
          ) : (
            <UploadCloudIcon className="text-muted-foreground size-6" />
          )}
          <span className="text-sm font-medium">
            {status === "uploading" ? "Parsing your syllabus…" : "Upload syllabus (PDF, DOCX, or image)"}
          </span>
          <span className="text-muted-foreground text-xs">Auto-parsed into a topic tree</span>
          <input
            id="syllabus-upload"
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,image/*"
            onChange={handleFileChange}
            disabled={status === "uploading"}
            className="sr-only"
          />
        </label>
        {status === "error" && (
          <p role="alert" className="text-destructive px-5 pb-4 text-center text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
