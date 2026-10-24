import { useState } from "react";
import { supabase } from "../lib/supabase";
import { shadowEmail } from "../lib/planner";
import { Card } from "./Card";
import { SparklesIcon } from "./icons";

/**
 * Sign in with the Planner account (same Supabase project): username + password,
 * mapped to the Planner's shadow email. There's no sign-up here — use the Planner.
 */
export function LoginView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: shadowEmail(username), password });
    if (error) setError(error.message === "Invalid login credentials" ? "Wrong username or password." : error.message);
    setBusy(false);
  }

  return (
    <Shell>
      <Card style={{ padding: 26 }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>Welcome back</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8 }}>Use your Planner username and password.</div>
          <input
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Planner username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
          {error && <div style={{ fontSize: 13, color: "var(--do-text)" }}>{error}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ padding: "11px 16px", fontSize: 14 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </Card>
    </Shell>
  );
}

export function SetupNotice() {
  return (
    <Shell>
      <Card>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Supabase isn't connected yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>, run{" "}
          <code>supabase/schema.sql</code> in the Supabase SQL Editor, then rebuild.
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <span className="icon-tile icon-tile--ai" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <SparklesIcon size={24} />
          </span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Daily <span className="gradient-text">Brief</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Your AI work triage, synced with your Planner</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
