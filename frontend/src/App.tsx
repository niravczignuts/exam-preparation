import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import { ensureAnonymousSession } from "./lib/supabaseClient";
import { ThemeProvider } from "./lib/theme";
import { SettingsProvider } from "./hooks/useSettings";
import { Toaster } from "./components/ui/sonner";
import { NavBar } from "./components/NavBar";
import { Home } from "./routes/Home";
import { MockTest } from "./routes/MockTest";
import { MockTestReport } from "./routes/MockTestReport";
import { MockTestRunner } from "./routes/MockTestRunner";
import { Practice } from "./routes/Practice";
import { Pyq } from "./routes/Pyq";
import { Settings } from "./routes/Settings";
import { Syllabus } from "./routes/Syllabus";
import { Timetable } from "./routes/Timetable";

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

  return (
    <ThemeProvider>
      <Toaster position="bottom-right" />
      {authError ? (
        <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-medium">Couldn't start a session: {authError}</p>
          <p className="text-muted-foreground text-sm">
            If this says anonymous sign-ins are disabled, enable them in the Supabase project's
            Auth settings (see docs/SETUP.md).
          </p>
        </main>
      ) : !authReady ? (
        <main className="flex min-h-svh items-center justify-center">
          <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
        </main>
      ) : (
        <SettingsProvider>
          <BrowserRouter>
            <div className="flex min-h-svh flex-col">
              <NavBar />
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/syllabus" element={<Syllabus />} />
                  <Route path="/pyq" element={<Pyq />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/timetable" element={<Timetable />} />
                  <Route path="/mock-test" element={<MockTest />} />
                  <Route path="/mock-test/:attemptId/run" element={<MockTestRunner />} />
                  <Route path="/mock-test/:attemptId/report" element={<MockTestReport />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </div>
          </BrowserRouter>
        </SettingsProvider>
      )}
    </ThemeProvider>
  );
}

export default App;
