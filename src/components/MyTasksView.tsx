import { quadrantLabel, quadrantOrder, quadrantStyle } from "../quadrant";
import type { MyTask, Quadrant } from "../types";
import { Card, SectionHeader } from "./Card";
import { ArrowRightIcon, CheckIcon, ListChecksIcon, XIcon } from "./icons";
import { PLANNER_URL } from "../lib/planner";
import { isoDate } from "../lib/dates";

const quadrantHint: Record<Quadrant, string> = {
  do: "Urgent & important — do today",
  schedule: "Important — plan a time",
  delegate: "Follow up with others",
  later: "Low priority",
};

function PlannerNote() {
  return (
    <div className="card rise card-ai" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "12px 16px" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>
        These are real tasks in your Planner — tick one here and it's ticked there. Changes made in the Planner show up here live.
      </span>
      <a className="btn" href={PLANNER_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
        Open Planner
        <ArrowRightIcon size={13} />
      </a>
    </div>
  );
}

export function MyTasksView({
  tasks,
  onToggleDone,
  onRemove,
}: {
  tasks: MyTask[];
  onToggleDone: (task: MyTask) => void;
  onRemove: (task: MyTask) => void;
}) {
  const open = tasks.filter((t) => !t.done);
  // Done tasks close automatically: they show under "Closed today" for the rest of the day.
  const done = tasks.filter((t) => t.done && t.closedOn === isoDate(new Date()));

  if (open.length === 0 && done.length === 0) {
    return (
      <Card>
        <SectionHeader icon={<ListChecksIcon size={15} />} label="My Tasks" />
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          No tasks yet — paste your brief on the Today tab and click <strong>Take</strong> on the items you'll handle.
          They're added to your Planner.
        </div>
      </Card>
    );
  }

  return (
    <>
      <PlannerNote />
      {quadrantOrder.map((q) => {
        const list = open.filter((t) => t.quadrant === q).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        if (list.length === 0) return null;
        const s = quadrantStyle[q];
        return (
          <Card key={q}>
            <SectionHeader
              icon={<span style={{ width: 10, height: 10, borderRadius: "50%", background: s.text, boxShadow: `0 0 0 4px ${s.bg}` }} />}
              label={quadrantLabel[q]}
              hint={quadrantHint[q]}
              count={list.length}
            />
            <TaskList tasks={list} onToggleDone={onToggleDone} onRemove={onRemove} />
          </Card>
        );
      })}

      {open.length === 0 && <div style={{ fontSize: 14, color: "var(--text-muted)" }}>All tasks done — nice work. ✨</div>}

      {done.length > 0 && (
        <Card>
          <SectionHeader icon={<CheckIcon size={14} />} label="Closed today" hint="Done here or in your Planner" count={done.length} />
          <TaskList tasks={done} onToggleDone={onToggleDone} onRemove={onRemove} />
        </Card>
      )}
    </>
  );
}

function TaskList({
  tasks,
  onToggleDone,
  onRemove,
}: {
  tasks: MyTask[];
  onToggleDone: (task: MyTask) => void;
  onRemove: (task: MyTask) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
      {tasks.map((t) => (
        <div key={t.id} className="item" style={{ flexWrap: "nowrap", gap: 12, padding: "11px 12px" }}>
          <button
            onClick={() => onToggleDone(t)}
            title={t.done ? "Mark as not done" : "Mark as done"}
            aria-label={t.done ? "Mark as not done" : "Mark as done"}
            style={{
              width: 22,
              height: 22,
              marginTop: 1,
              flex: "none",
              borderRadius: "50%",
              border: t.done ? "none" : "1.5px solid var(--border-strong)",
              background: t.done ? "var(--ai-gradient)" : "var(--card-solid)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "transform 0.12s ease",
            }}
          >
            {t.done && <CheckIcon size={12} color="#fff" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                overflowWrap: "anywhere",
                textDecoration: t.done ? "line-through" : "none",
                color: t.done ? "var(--text-faint)" : "var(--text)",
              }}
            >
              {t.title}
            </div>
            {!t.done && t.action && (
              <div style={{ display: "flex", gap: 6, fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                <ArrowRightIcon size={13} style={{ flex: "none", marginTop: 3, color: "var(--accent)" }} />
                <span>{t.action}</span>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {t.due && (
                <span className="chip" style={{ background: t.due === "Overdue" || t.due === "Today" ? "var(--badge-urgent-bg)" : "var(--divider)", color: t.due === "Overdue" || t.due === "Today" ? "var(--badge-urgent-text)" : "var(--text-muted)" }}>
                  Due {t.due.toLowerCase()}
                </span>
              )}
              {t.from && <span className="chip" style={{ background: "var(--divider)", color: "var(--text-muted)", fontWeight: 500 }}>{t.from}</span>}
              {t.refs.map((r) => (
                <span key={r} className="chip" style={{ background: "var(--divider)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
          <button className="btn btn-icon" onClick={() => onRemove(t)} title="Delete from Planner" aria-label="Delete from Planner" style={{ width: 28, height: 28 }}>
            <XIcon size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
