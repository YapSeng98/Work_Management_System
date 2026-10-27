import { quadrantLabel, quadrantOrder, quadrantStyle } from "../quadrant";
import { useState } from "react";
import type { MyTask, Quadrant, TaskEdit } from "../types";
import { Card, SectionHeader } from "./Card";
import { ArrowRightIcon, CheckIcon, ListChecksIcon, PencilIcon, XIcon } from "./icons";
import { PLANNER_URL, splitNotes } from "../lib/planner";
import { isoDate } from "../lib/dates";
import { normTitle } from "../lib/brief";

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
  onEdit,
}: {
  tasks: MyTask[];
  onToggleDone: (task: MyTask) => void;
  onRemove: (task: MyTask) => void;
  onEdit: (task: MyTask, edit: TaskEdit) => Promise<void>;
}) {
  const open = tasks.filter((t) => !t.done);
  // Open tasks that share a ticket or subject with an earlier-listed one: likely duplicates.
  const dupes = new Set<string>();
  open.forEach((t, i) => {
    const title = normTitle(t.title);
    if (open.slice(0, i).some((o) => o.refs.some((r) => t.refs.includes(r)) || (title.length > 8 && normTitle(o.title) === title))) dupes.add(t.id);
  });
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
            <TaskList tasks={list} onToggleDone={onToggleDone} onRemove={onRemove} onEdit={onEdit} dupes={dupes} />
          </Card>
        );
      })}

      {open.length === 0 && <div style={{ fontSize: 14, color: "var(--text-muted)" }}>All tasks done — nice work. ✨</div>}

      {done.length > 0 && (
        <Card>
          <SectionHeader icon={<CheckIcon size={14} />} label="Closed today" hint="Done here or in your Planner" count={done.length} />
          <TaskList tasks={done} onToggleDone={onToggleDone} onRemove={onRemove} onEdit={onEdit} />
        </Card>
      )}
    </>
  );
}

function TaskList({
  tasks,
  onToggleDone,
  onRemove,
  onEdit,
  dupes,
}: {
  tasks: MyTask[];
  onToggleDone: (task: MyTask) => void;
  onRemove: (task: MyTask) => void;
  onEdit: (task: MyTask, edit: TaskEdit) => Promise<void>;
  dupes?: Set<string>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
      {tasks.map((t) => (
        <div key={t.id} className="item" style={{ flexWrap: "wrap", gap: 12, padding: "11px 12px" }}>
          <button
            className="task-check"
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
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
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
              {dupes?.has(t.id) && (
                <span className="chip" style={{ background: "var(--badge-warn-bg)", color: "var(--badge-warn-text)" }} title="Same ticket or subject as another open task — delete the extra one with ✕">
                  Possible duplicate
                </span>
              )}
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
          <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <button className="btn btn-icon" onClick={() => setEditing(editing === t.id ? null : t.id)} title="Edit" aria-label="Edit task" style={{ width: 28, height: 28 }}>
              <PencilIcon size={12} />
            </button>
            <button className="btn btn-icon" onClick={() => onRemove(t)} title="Delete from Planner" aria-label="Delete from Planner" style={{ width: 28, height: 28 }}>
              <XIcon size={12} />
            </button>
          </div>
          {editing === t.id && (
            <TaskEditor
              task={t}
              onCancel={() => setEditing(null)}
              onSave={async (edit) => {
                await onEdit(t, edit);
                setEditing(null);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const PLANNER_PRIORITIES = [
  { value: 1, label: "Critical" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
  { value: 5, label: "Optional" },
];

/** Edit a Planner task in place: title, due date, priority, group and notes. */
function TaskEditor({ task, onSave, onCancel }: { task: MyTask; onSave: (edit: TaskEdit) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [dueIso, setDueIso] = useState(task.dueIso ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [quadrant, setQuadrant] = useState<Quadrant>(task.quadrant);
  const [body, setBody] = useState(splitNotes(task.notes).body);
  const [busy, setBusy] = useState(false);
  const label = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" } as const;

  return (
    <form
      className="reply"
      style={{ flex: "1 1 100%", flexDirection: "column", alignItems: "stretch", gap: 12, padding: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ title, dueIso, priority, quadrant, body });
        } catch {
          // the error banner explains; keep the form so nothing typed is lost
        } finally {
          setBusy(false);
        }
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Edit task — saved to your Planner</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={label}>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 140px" }}>
          <span style={label}>Due date</span>
          <input className="input" type="date" value={dueIso} onChange={(e) => setDueIso(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 140px" }}>
          <span style={label}>Priority</span>
          <select className="input" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            {PLANNER_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 140px" }}>
          <span style={label}>Group</span>
          <select className="input" value={quadrant} onChange={(e) => setQuadrant(e.target.value as Quadrant)}>
            {quadrantOrder.map((q) => (
              <option key={q} value={q}>
                {quadrantLabel[q]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={label}>Notes</span>
        <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(10, Math.max(3, body.split("\n").length + 1))} style={{ resize: "vertical", lineHeight: 1.5 }} />
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
