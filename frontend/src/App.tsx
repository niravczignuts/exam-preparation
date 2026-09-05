import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    fetch(`${base}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("unreachable")))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Exam Prep App</h1>
      <p>Foundation scaffold — Sprint 1 (see docs/SETUP.md to wire up the rest).</p>
      <p>Backend API: {apiStatus}</p>
    </main>
  );
}

export default App;
