import type { Tab } from "../types";
import { LogOutIcon, SparklesIcon } from "./icons";

export function Header({
  tab,
  onTabChange,
  status,
  taskCount,
  email,
  onSignOut,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  status: string;
  taskCount: number;
  email: string;
  onSignOut: () => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "tasks", label: taskCount ? `My Tasks · ${taskCount}` : "My Tasks" },
    { id: "history", label: "History" },
  ];

  return (
    <header className="card topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="icon-tile icon-tile--ai" style={{ width: 32, height: 32, borderRadius: 10 }}>
          <SparklesIcon size={17} />
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Daily Brief</h1>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>AI work triage</div>
        </div>
      </div>

      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " tab--active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="chip"
          style={{ background: "var(--divider)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 500 }}
        >
          <span className="chip__dot" style={{ background: "var(--success)" }} />
          {status}
        </span>
        <button className="btn btn-icon" onClick={onSignOut} title={email ? `Sign out (${email})` : "Sign out"} aria-label="Sign out">
          <LogOutIcon size={15} />
        </button>
      </div>
    </header>
  );
}
