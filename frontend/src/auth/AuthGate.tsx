import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../supabase";
import { useSession } from "./useSession";

/** Renders its children once a Supabase Auth session exists; otherwise
 * shows a minimal email/password sign-in/sign-up form. */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error" | "check-email">("idle");
  const [error, setError] = useState<string | null>(null);

  if (session === "loading") return <p>Loading…</p>;
  if (session) return <>{children}</>;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("pending");
    setError(null);

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus(mode === "sign-up" ? "check-email" : "idle");
  }

  return (
    <main>
      <h1>Exam Prep App</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        <button type="submit" disabled={status === "pending"}>
          {mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      {status === "error" && <p role="alert">{error}</p>}
      {status === "check-email" && <p>Check your email to confirm your account, then sign in.</p>}
    </main>
  );
}
