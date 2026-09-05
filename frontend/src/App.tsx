import { useEffect, useState } from "react";
import "./App.css";
import { requestPushToken } from "./firebase";

function App() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");
  const [pushToken, setPushToken] = useState<string | null | "pending" | "error">(null);

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
    } catch (err) {
      console.error("requestPushToken failed", err);
      setPushToken("error");
    }
  }

  return (
    <main>
      <h1>Exam Prep App</h1>
      <p>Foundation scaffold — Sprint 1 (see docs/SETUP.md to wire up the rest).</p>
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

export default App;
