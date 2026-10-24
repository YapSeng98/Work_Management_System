import type { HistoryAction, HistoryEntry } from "../types";
import { quadrantStyle } from "../quadrant";
import { isoDate } from "../lib/dates";
import { Card, SectionHeader } from "./Card";
import { StatTiles } from "./StatTiles";
import { CalendarIcon, CheckIcon, XIcon } from "./icons";

/** One row in "Past briefs", summarised from a stored brief. */
export interface BriefSummary {
  id: string;
  title: string;
  briefDate: string;
  mine: number;
  chase: number;
  meetings: number;
  isCurrent: boolean;
}

function actionIcon(action: HistoryAction, quadrant?: HistoryEntry["quadrant"]) {
  if (action === "taken" && quadrant) {
    const s = quadrantStyle[quadrant];
    return { bg: s.bg, color: s.text, icon: <CheckIcon size={13} color={s.text} /> };
  }
  if (action === "done") {
    return { bg: "var(--text)", color: "var(--bg)", icon: <CheckIcon size={13} color="var(--bg)" /> };
  }
  return { bg: "var(--divider)", color: "var(--text-faint)", icon: <XIcon size={12} color="var(--text-faint)" /> };
}

function actionLabel(action: HistoryAction) {
  if (action === "taken") return "taken to My Tasks";
  if (action === "done") return "completed";
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

export function HistoryView({
  entries,
  briefs,
  openTasks,
  onViewBrief,
}: {
  entries: HistoryEntry[];
  briefs: BriefSummary[];
  openTasks: number;
  onViewBrief: (id: string) => void;
}) {
  const grouped = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.date) ?? [];
    list.push(entry);
    grouped.set(entry.date, list);
  }
  const dates = Array.from(grouped.keys()).sort((a, b) => (a < b ? 1 : -1));

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const since = isoDate(weekAgo);
  const count = (action: HistoryAction) => entries.filter((e) => e.date >= since && e.action === action).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <StatTiles
        tiles={[
          { value: String(briefs.filter((b) => b.briefDate >= since).length), label: "briefs in last 7 days" },
          { value: String(count("taken")), label: "taken in last 7 days" },
          { value: String(count("done")), label: "done in last 7 days", accent: true },
          { value: String(openTasks), label: "tasks still open" },
        ]}
      />

      <Card>
        <SectionHeader
          icon={<CalendarIcon />}
          label="Past briefs"
          right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{briefs.length}</span>}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {briefs.map((b, i) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: i < briefs.length - 1 ? "1px solid var(--divider)" : "none",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-faint)", width: 92, flex: "none" }}>
                {b.briefDate}
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                  {b.mine} pending you · {b.chase} to chase · {b.meetings} meetings
                </div>
              </div>
              {b.isCurrent ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Showing on Today</span>
              ) : (
                <button
                  onClick={() => onViewBrief(b.id)}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 7,
                    border: "1.5px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--text-muted)",
                  }}
                >
                  View
                </button>
              )}
            </div>
          ))}
          {briefs.length === 0 && (
            <div style={{ fontSize: 14, color: "var(--text-faint)" }}>No briefs yet — paste one on the Today tab.</div>
          )}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <SectionHeader icon={<CheckIcon size={14} />} label="Activity" />
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
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, overflowWrap: "anywhere" }}>
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
          <div style={{ fontSize: 14, color: "var(--text-faint)" }}>Nothing logged yet — take or dismiss items on Today to start building history.</div>
        )}
      </div>
    </div>
  );
}
