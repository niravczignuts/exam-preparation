import { useCallback, useRef, useState } from "react";

/** Thin wrapper around the browser's MediaRecorder/getUserMedia APIs — no
 * existing audio code in the repo to build on, this is genuinely new. Used to
 * feed voice check-ins (Whisper transcription) as an optional alternative to
 * typing, never a replacement for it. */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      stopResolveRef.current?.(blob);
      stopResolveRef.current = null;
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob());
        return;
      }
      stopResolveRef.current = resolve;
      recorder.stop();
      setIsRecording(false);
    });
  }, []);

  return { isRecording, start, stop };
}
