import { quadrantLabel, quadrantOrder, quadrantStyle } from "../quadrant";
import type { MyTask, Quadrant } from "../types";
import { Card, SectionHeader } from "./Card";
import { CheckIcon, ListChecksIcon, XIcon } from "./icons";
import { PLANNER_URL } from "../lib/planner";
import { isoDate } from "../lib/dates";

function PlannerNote() {
  return (
    <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
      These are real tasks in your{" "}
      <a href={PLANNER_URL} target="_blank" rel="noreferrer">
        Planner
      </a>{" "}
      — ticking one here ticks it there, and changes made in the Planner show up here live.
    </div>
  );
}

const quadrantHint: Record<Quadrant, string> = {
  do: "urgent & important — do today",
  schedule: "important — plan a time",
  delegate: "follow up with others",
  later: "low priority",
};

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
        <SectionHeader icon={<ListChecksIcon />} label="My Tasks" />
        <div style={{ fontSize: 14, color: "var(--text-faint)" }}>
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
              icon={<span style={{ width: 10, height: 10, borderRadius: 3, background: s.text, display: "inline-block" }} />}
              label={`${quadrantLabel[q]} — ${quadrantHint[q]}`}
              right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{list.length}</span>}
            />
            <TaskList tasks={list} onToggleDone={onToggleDone} onRemove={onRemove} />
          </Card>
        );
      })}

      {open.length === 0 && (
        <div style={{ fontSize: 14, color: "var(--text-faint)" }}>All tasks done — nice work.</div>
      )}

      {done.length > 0 && (
        <Card>
          <SectionHeader
            icon={<CheckIcon size={14} />}
            label={`Closed today (${done.length})`}
          />
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
    <div style={{ display: "flex", flexDirection: "column" }}>
      {tasks.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "12px 0",
            borderBottom: i < tasks.length - 1 ? "1px solid var(--divider)" : "none",
          }}
        >
          <button
            onClick={() => onToggleDone(t)}
            title={t.done ? "Mark as not done" : "Mark as done"}
            style={{
              width: 20,
              height: 20,
              marginTop: 1,
              flex: "none",
              borderRadius: 5,
              border: `1.5px solid ${t.done ? "var(--text)" : "var(--border)"}`,
              background: t.done ? "var(--text)" : "var(--card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            {t.done && <CheckIcon size={12} color="var(--bg)" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflowWrap: "anywhere",
                textDecoration: t.done ? "line-through" : "none",
                color: t.done ? "var(--text-faint)" : "var(--text)",
              }}
            >
              {t.title}
            </div>
            {!t.done && t.action && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>→ {t.action}</div>}
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
              {[t.due && `due ${t.due.toLowerCase()}`, t.from && `from ${t.from}`, t.refs.length ? t.refs.join(", ") : undefined].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            onClick={() => onRemove(t)}
            title="Delete from Planner"
            style={{ background: "none", border: "none", color: "var(--text-faint)", padding: 4, flex: "none" }}
          >
            <XIcon size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
