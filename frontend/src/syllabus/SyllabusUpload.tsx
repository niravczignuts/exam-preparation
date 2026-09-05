import { useRef, useState, type ChangeEvent } from "react";
import { supabase } from "../supabase";

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
      onUploaded();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label>
        Upload syllabus (PDF, DOCX, or image) — auto-parsed into a topic tree
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,image/*"
          onChange={handleFileChange}
          disabled={status === "uploading"}
        />
      </label>
      {status === "uploading" && <p>Parsing your syllabus… this can take a moment.</p>}
      {status === "error" && <p role="alert">{error}</p>}
    </div>
  );
}
