import { quadrantLabel, quadrantStyle } from "../quadrant";
import type { CandidateTask } from "../types";
import { CheckIcon, ClockIcon, XIcon } from "./icons";

export function CandidateTaskRow({
  task,
  isLast,
  onAdd,
  onSnooze,
  onDismiss,
}: {
  task: CandidateTask;
  isLast: boolean;
  onAdd: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  const style = quadrantStyle[task.quadrant];

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid var(--divider)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: style.text,
          background: style.bg,
          padding: "5px 10px",
          borderRadius: 6,
          flex: "none",
        }}
      >
        {quadrantLabel[task.quadrant].toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{task.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
          from {task.fromName} · {task.fromEmail}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        <button
          onClick={onAdd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            background: "var(--text)",
            color: "var(--bg)",
            padding: "8px 14px",
            borderRadius: 7,
            border: "none",
          }}
        >
          <CheckIcon size={13} color="var(--bg)" />
          Add to Planner
        </button>
        <button
          onClick={onSnooze}
          title="Snooze"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            border: "1px solid #dedbd1",
            borderRadius: 7,
            background: "var(--card)",
            color: "var(--text-faint)",
            flex: "none",
          }}
        >
          <ClockIcon size={14} />
        </button>
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            border: "1px solid #dedbd1",
            borderRadius: 7,
            background: "var(--card)",
            color: "var(--text-faint)",
            flex: "none",
          }}
        >
          <XIcon size={13} />
        </button>
      </div>
    </div>
  );
}
