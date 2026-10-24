import { useState } from "react";
import { supabase } from "../lib/supabase";
import { shadowEmail } from "../lib/planner";
import { Card } from "./Card";
import { MailIcon } from "./icons";

const inputStyle: React.CSSProperties = {
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--card)",
  color: "var(--text)",
};

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
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Sign in</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -6 }}>Use your Planner username and password.</div>
          <input
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Planner username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <div style={{ fontSize: 13, color: "var(--do-text)" }}>{error}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--bg)",
              background: "var(--text)",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              opacity: busy ? 0.6 : 1,
            }}
          >
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
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MailIcon size={18} color="var(--bg)" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Daily Brief</div>
        </div>
        {children}
      </div>
    </div>
  );
}
