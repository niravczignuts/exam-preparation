import { useEffect, useState } from "react";
import { CountdownTile } from "../countdown/CountdownTile";
import { onForegroundMessage, requestPushToken } from "../firebase";
import { useExamStages } from "../hooks/useExamStages";

export function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");
  const [pushToken, setPushToken] = useState<string | null | "pending" | "error">(null);
  const { stages, loading, deleteStage } = useExamStages();

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    fetch(`${base}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("unreachable")))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  async function enableNotifications() {
    setPushToken("pending");
    try {
      const token = await requestPushToken();
      setPushToken(token);
      if (token) {
        // Only fires while this tab is focused — FCM routes to the service
        // worker's background handler otherwise. Shown manually since the
        // browser won't auto-display a notification for a focused tab.
        onForegroundMessage((payload) => {
          const { title, body } = payload.notification ?? {};
          new Notification(title ?? "Exam Prep App", { body: body ?? "" });
        });
      }
    } catch (err) {
      console.error("requestPushToken failed", err);
      setPushToken("error");
    }
  }

  return (
    <main>
      <h1>Exam Prep App</h1>

      {!loading && stages.length > 0 && (
        <div className="countdown-grid">
          {stages.map((stage) => (
            <CountdownTile key={stage.id} stage={stage} onRemove={() => deleteStage(stage.id)} />
          ))}
        </div>
      )}
      {!loading && stages.length === 0 && (
        <p>No exam dates configured yet — add one in Settings.</p>
      )}

      <p>Backend API: {apiStatus}</p>

      <button type="button" onClick={enableNotifications}>
        Enable notifications
      </button>
      {pushToken === "pending" && <p>Requesting permission…</p>}
      {pushToken === "error" && <p>Failed to get a push token — check the console.</p>}
      {pushToken === null && <p>No FCM token yet.</p>}
      {pushToken && pushToken !== "pending" && pushToken !== "error" && (
        <p style={{ wordBreak: "break-all" }}>
          FCM token (paste into a backend test call): <code>{pushToken}</code>
        </p>
      )}
    </main>
  );
}
