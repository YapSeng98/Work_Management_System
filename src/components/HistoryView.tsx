import type { HistoryAction, HistoryEntry } from "../types";
import { quadrantStyle } from "../quadrant";
import { CheckIcon, ClockIcon, XIcon } from "./icons";

function actionIcon(action: HistoryAction, quadrant?: HistoryEntry["quadrant"]) {
  if (action === "added" && quadrant) {
    const s = quadrantStyle[quadrant];
    return { bg: s.bg, color: s.text, icon: <CheckIcon size={13} color={s.text} /> };
  }
  if (action === "snoozed") {
    return { bg: "var(--later-bg)", color: "var(--later-text)", icon: <ClockIcon size={12} color="var(--later-text)" /> };
  }
  return { bg: "var(--divider)", color: "var(--text-faint)", icon: <XIcon size={12} color="var(--text-faint)" /> };
}

function actionLabel(action: HistoryAction) {
  if (action === "added") return "added to Planner";
  if (action === "snoozed") return "snoozed to tomorrow";
  return "dismissed";
}

function formatDateGroup(iso: string): string {
  const date = new Date(iso + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const label = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (sameDay(date, today)) return `Today · ${label.split(", ").slice(1).join(", ") || label}`;
  if (sameDay(date, yesterday)) return `Yesterday · ${label.split(", ").slice(1).join(", ") || label}`;
  return label;
}

export function HistoryView({ entries }: { entries: HistoryEntry[] }) {
  const grouped = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.date) ?? [];
    list.push(entry);
    grouped.set(entry.date, list);
  }
  const dates = Array.from(grouped.keys()).sort((a, b) => (a < b ? 1 : -1));

  const addedCount = entries.filter((e) => e.action === "added").length;
  const snoozedCount = entries.filter((e) => e.action === "snoozed").length;
  const dismissedCount = entries.filter((e) => e.action === "dismissed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        <StatTile value={addedCount} label="added this week" />
        <StatTile value={snoozedCount} label="snoozed this week" />
        <StatTile value={dismissedCount} label="dismissed this week" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {dates.map((date) => (
          <div key={date} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: "var(--text-muted)" }}>
              {formatDateGroup(date)}
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "6px 24px" }}>
              {(grouped.get(date) ?? []).map((entry, i, arr) => {
                const style = actionIcon(entry.action, entry.quadrant);
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "13px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--divider)" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: style.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      {style.icon}
                    </div>
                    <div style={{ flex: 1, fontSize: 14 }}>
                      {entry.title} <span style={{ color: "var(--text-faint)" }}>— {actionLabel(entry.action)}</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", flex: "none" }}>
                      {entry.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {dates.length === 0 && (
          <div style={{ fontSize: 14, color: "var(--text-faint)" }}>Nothing logged yet — act on today's brief to start building history.</div>
        )}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", letterSpacing: "0.03em" }}>{label}</div>
    </div>
  );
}
