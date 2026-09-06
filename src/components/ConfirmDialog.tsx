import { useState } from "react";
import { quadrantOrder, quadrantLabel } from "../quadrant";
import type { CandidateTask, Quadrant } from "../types";
import { CheckIcon, ChevronDownIcon, XIcon } from "./icons";

export function ConfirmDialog({
  task,
  onCancel,
  onConfirm,
}: {
  task: CandidateTask;
  onCancel: () => void;
  onConfirm: (edited: { title: string; quadrant: Quadrant; due: string; project: string }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [quadrant, setQuadrant] = useState<Quadrant>(task.quadrant);
  const [due, setDue] = useState(task.suggestedDue);
  const [project, setProject] = useState(task.suggestedProject);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,26,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 20px 40px -20px rgba(28,28,26,0.35)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Confirm task</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-faint)" }}>
            <XIcon size={16} />
          </button>
        </div>

        <div style={{ background: "var(--bg)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--text-faint)", textTransform: "uppercase" }}>
            Drafted from email
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {task.fromName} — "{task.sourceSubject}"
          </div>
        </div>

        <Field label="Task title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              border: "1.5px solid var(--text)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14.5,
              fontWeight: 500,
              fontFamily: "inherit",
            }}
          />
        </Field>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Priority</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {quadrantOrder.map((q) => {
              const active = q === quadrant;
              const colors: Record<Quadrant, string> = {
                do: "var(--do-text)",
                schedule: "var(--schedule-text)",
                delegate: "var(--delegate-text)",
                later: "var(--later-text)",
              };
              return (
                <button
                  key={q}
                  onClick={() => setQuadrant(q)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: active ? "#fff" : colors[q],
                    background: active ? colors[q] : "var(--card)",
                    padding: "7px 12px",
                    borderRadius: 7,
                    border: `1.5px solid ${active ? colors[q] : "var(--border)"}`,
                  }}
                >
                  {quadrantLabel[q].toUpperCase()}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Suggested from the email — click another to override.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <Field label="Due" style={{ flex: 1 }}>
            <SelectLike value={due} onChange={setDue} options={["Today", "Tomorrow", "This week", "Next week"]} />
          </Field>
          <Field label="Project" style={{ flex: 1 }}>
            <SelectLike value={project} onChange={setProject} options={["Cosmetica", "1FSS", "Personal Work", "Personal"]} />
          </Field>
        </div>

        <div style={{ height: 1, background: "var(--divider)", marginTop: 4 }} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              padding: "10px 16px",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              background: "var(--card)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ title, quadrant, due, project })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--bg)",
              background: "var(--text)",
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
            }}
          >
            <CheckIcon size={14} color="var(--bg)" />
            Confirm &amp; add to Planner
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>
      {children}
    </div>
  );
}

function SelectLike({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          width: "100%",
          border: "1.5px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: "inherit",
          background: "var(--card)",
          color: "var(--text)",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-faint)" }}>
        <ChevronDownIcon size={14} />
      </div>
    </div>
  );
}
