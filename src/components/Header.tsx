import { ClockIcon, MailIcon } from "./icons";

type Tab = "today" | "history";

export function Header({ tab, onTabChange, syncedAt }: { tab: Tab; onTabChange: (t: Tab) => void; syncedAt: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <MailIcon size={18} color="var(--bg)" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Daily Brief</div>

        <TabLink label="Today" active={tab === "today"} onClick={() => onTabChange("today")} />
        <TabLink label="History" active={tab === "history"} onClick={() => onTabChange("history")} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-faint)",
        }}
      >
        <ClockIcon size={14} />
        synced {syncedAt}
      </div>
    </div>
  );
}

function TabLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        marginLeft: 6,
        paddingBottom: 1,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--accent)" : "var(--text-faint)",
        borderBottom: active ? "1.5px solid var(--accent)" : "1px solid transparent",
      }}
    >
      {label}
    </button>
  );
}
