import { useState } from "react";
import { supabase } from "../lib/supabase";
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
 * Email + password sign-in. Accounts are created in the Supabase dashboard
 * (public sign-up is meant to be switched off), so there's no sign-up form.
 */
export function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <Shell>
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Sign in</div>
          <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
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
