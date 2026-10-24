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
    return { bg: "var(--ai-gradient)", color: "#fff", icon: <CheckIcon size={13} color="#fff" /> };
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
  onClearAll,
}: {
  entries: HistoryEntry[];
  briefs: BriefSummary[];
  openTasks: number;
  onViewBrief: (id: string) => void;
  onClearAll: () => void;
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
        <SectionHeader icon={<CalendarIcon size={15} />} label="Past briefs" hint="Every brief you've pasted — reopen any of them" count={briefs.length} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
          {briefs.map((b, i) => (
            <div key={b.id} className="item" style={{ alignItems: "center", gap: 12, padding: "10px 12px", animationDelay: `${i * 30}ms` }}>
              <span className="chip" style={{ background: "var(--divider)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 500, flex: "none" }}>
                {b.briefDate}
              </span>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                  {b.mine} pending you · {b.chase} to chase · {b.meetings} meetings
                </div>
              </div>
              {b.isCurrent ? (
                <span className="chip" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                  <span className="chip__dot" />
                  Showing on Today
                </span>
              ) : (
                <button className="btn" onClick={() => onViewBrief(b.id)}>
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
        <SectionHeader icon={<CheckIcon size={14} />} label="Activity" hint="Everything you took, finished or dismissed" />
        {dates.map((date) => (
          <div key={date} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: "var(--text-muted)" }}>
              {formatDateGroup(date)}
            </div>
            <div className="card rise" style={{ padding: "6px 20px", gap: 0 }}>
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
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
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

      <div className="card rise" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 18px" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Start fresh</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Delete all pasted briefs, dismissed items and history. You'll be asked separately about tasks in your Planner.
          </div>
        </div>
        <button className="btn" onClick={onClearAll} style={{ color: "var(--do-text)", borderColor: "var(--badge-urgent-bg)" }}>
          Clear all data
        </button>
      </div>
    </div>
  );
}
