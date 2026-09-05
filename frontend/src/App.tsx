import { useEffect, useState } from "react";
import "./App.css";
import { AuthGate } from "./auth/AuthGate";
import { signOut } from "./auth/useSession";
import { ExamStages } from "./countdown/ExamStages";
import { onForegroundMessage, requestPushToken } from "./firebase";
import { SyllabusTree } from "./syllabus/SyllabusTree";
import { SyllabusUpload } from "./syllabus/SyllabusUpload";

type Tab = "home" | "syllabus";

function AppContent() {
  const [tab, setTab] = useState<Tab>("home");
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");
  const [pushToken, setPushToken] = useState<string | null | "pending" | "error">(null);
  const [syllabusRefreshKey, setSyllabusRefreshKey] = useState(0);

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
      <header className="app-header">
        <h1>Exam Prep App</h1>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <nav className="tabs">
        <button type="button" disabled={tab === "home"} onClick={() => setTab("home")}>
          Home
        </button>
        <button type="button" disabled={tab === "syllabus"} onClick={() => setTab("syllabus")}>
          Syllabus
        </button>
      </nav>

      {tab === "home" && (
        <>
          <ExamStages />

          <section>
            <h2>Notifications</h2>
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
          </section>
        </>
      )}

      {tab === "syllabus" && (
        <>
          <SyllabusUpload onUploaded={() => setSyllabusRefreshKey((k) => k + 1)} />
          <SyllabusTree key={syllabusRefreshKey} />
        </>
      )}
    </main>
  );
}

function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

export default App;
