import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { ensureAnonymousSession } from "./lib/supabaseClient";
import { SettingsProvider } from "./hooks/useSettings";
import { NavBar } from "./components/NavBar";
import { Home } from "./routes/Home";
import { Settings } from "./routes/Settings";

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonymousSession()
      .then(() => setAuthReady(true))
      .catch((err: unknown) => {
        console.error("ensureAnonymousSession failed", err);
        setAuthError(err instanceof Error ? err.message : "Failed to start a session.");
      });
  }, []);

  if (authError) {
    return (
      <main>
        <p>Couldn't start a session: {authError}</p>
        <p>
          If this says anonymous sign-ins are disabled, enable them in the Supabase project's
          Auth settings (see docs/SETUP.md).
        </p>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="app-loading">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <SettingsProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
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
