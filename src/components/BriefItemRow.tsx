import { useState } from "react";
import { quadrantLabel, quadrantStyle } from "../quadrant";
import type { BriefItem, Priority } from "../lib/brief";
import { notesFooter, plannerDue, plannerNotesBody, type TakeEdit } from "../lib/planner";
import { ArrowRightIcon, CheckIcon, CopyIcon, PencilIcon, SparklesIcon, XIcon } from "./icons";
import { Pill } from "./Pill";

/** new = not taken; taken = an open task covers it; done = taken before and completed. */
export type ItemStatus = "new" | "taken" | "done";

const priorityStyle = {
  critical: { bg: "var(--critical-bg)", color: "#fff" },
  high: { bg: "var(--badge-urgent-bg)", color: "var(--badge-urgent-text)" },
  medium: { bg: "var(--badge-warn-bg)", color: "var(--badge-warn-text)" },
  low: { bg: "var(--later-bg)", color: "var(--later-text)" },
};

const kindLabel = {
  reply: "Needs reply",
  action: "Action required",
  decision: "Decision required",
  follow_up: "Follow up",
  fyi: "FYI",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function BriefItemRow({
  item,
  status,
  since,
  briefTitle,
  onTake,
  onDismiss,
  onComplete,
}: {
  item: BriefItem;
  isLast?: boolean;
  status: ItemStatus;
  since?: string;
  briefTitle?: string;
  onTake?: (edit?: TakeEdit) => void;
  onDismiss?: () => void;
  onComplete?: () => void;
}) {
  const q = quadrantStyle[item.quadrant];
  const taken = status === "taken";
  const [editing, setEditing] = useState(false);

  return (
    <div className="item" style={taken ? { background: "var(--divider)" } : undefined}>
      <span className="item__bar" style={{ background: q.text }} />
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Pill dot label={quadrantLabel[item.quadrant]} bg={q.bg} color={q.text} />
          {item.kind !== "fyi" && <Pill label={cap(item.priority)} {...priorityStyle[item.priority]} />}
          {item.topRank && <Pill label={`Top ${item.topRank}`} bg="var(--accent-tint)" color="var(--accent)" />}
          {item.category && !/^waiting on/i.test(item.category) && <Pill label={item.category} bg="var(--divider)" color="var(--text-muted)" />}
          {item.escalation && <Pill label="Escalation" bg="var(--critical-bg)" color="#fff" />}
          {(item.risk === "critical" || item.risk === "high") && (
            <Pill label={`${cap(item.risk)} risk`} {...priorityStyle[item.risk === "critical" ? "high" : "medium"]} />
          )}
          {item.due && <Pill label={`Due ${item.due.toLowerCase()}`} bg="var(--badge-urgent-bg)" color="var(--badge-urgent-text)" />}
          {item.personal && <Pill label="For you" bg="var(--schedule-bg)" color="var(--schedule-text)" />}
          {item.waitingSince && <Pill label={`Waiting since ${item.waitingSince}`} bg="var(--badge-warn-bg)" color="var(--badge-warn-text)" />}
          {since && <Pill label={`Pending since ${since}`} bg="var(--badge-warn-bg)" color="var(--badge-warn-text)" />}
          {item.waitingOnCustomer && <Pill label="Awaiting customer" bg="var(--delegate-bg)" color="var(--delegate-text)" />}
          {item.canClose && <Pill label="Can close" bg="var(--later-bg)" color="var(--success)" />}
          {item.changedToday && <Pill dot label="Changed today" bg="var(--accent-tint)" color="var(--accent)" />}
          {item.engagement && <Pill label="Engagement" bg="var(--schedule-bg)" color="var(--schedule-text)" />}
          {item.completed && <Pill dot label="Completed" bg="var(--later-bg)" color="var(--success)" />}
          {status === "done" && <Pill label="Done before" bg="var(--later-bg)" color="var(--later-text)" />}
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em", overflowWrap: "anywhere" }}>{item.title}</div>

        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {[
            item.customer,
            item.ownerName && `Owner: ${item.ownerName}`,
            item.from && `Last from ${item.from}`,
            kindLabel[item.kind],
            item.stage && cap(item.stage),
            item.source && `via ${item.source}`,
            item.ownerName && item.ownerReason.startsWith("Owned by") ? undefined : item.ownerReason,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </div>

        {item.status && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-faint)" }}>Status </span>
            {item.status}
          </div>
        )}
        {item.summary && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.summary}</div>}
        {item.action && (
          <div style={{ display: "flex", gap: 6, fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
            <ArrowRightIcon size={14} style={{ flex: "none", marginTop: 3, color: "var(--accent)" }} />
            <span>{item.action}</span>
          </div>
        )}
        {item.timeline && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>⏱ {item.timeline}</div>}
        {item.suggestedReply && !editing && <SuggestedReply text={item.suggestedReply} />}
      </div>

      {onTake && editing && (
        <TakeEditor
          item={item}
          briefTitle={briefTitle}
          onCancel={() => setEditing(false)}
          onSubmit={(edit) => {
            setEditing(false);
            onTake(edit);
          }}
        />
      )}

      {onComplete && taken && (
        <div style={{ display: "flex", gap: 6, flex: "none", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={onComplete} title="The brief says this is done — tick the Planner task">
            <CheckIcon size={13} color="#fff" />
            Mark done in Planner
          </button>
        </div>
      )}

      {onTake && !editing && (
        <div style={{ display: "flex", gap: 6, flex: "none", alignItems: "center" }}>
          {taken ? (
            <button className="btn btn-done" disabled title="Already a task in your Planner">
              <CheckIcon size={13} />
              In My Tasks
            </button>
          ) : (
            <>
              <button className={status === "done" ? "btn" : "btn btn-primary"} onClick={() => onTake()} title="Create this as a task in your Planner">
                {status === "done" ? "Take again" : "Take"}
                <ArrowRightIcon size={13} />
              </button>
              {status === "new" && (
                <button className="btn btn-icon" onClick={() => setEditing(true)} title="Edit & take" aria-label="Edit, then take">
                  <PencilIcon size={14} />
                </button>
              )}
            </>
          )}
          {!taken && onDismiss && (
            <button className="btn btn-icon" onClick={onDismiss} title="Dismiss" aria-label="Dismiss">
              <XIcon size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestedReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — the text is still on screen to select.
    }
  }
  return (
    <div className="reply">
      <SparklesIcon size={15} style={{ flex: "none", marginTop: 2, color: "var(--accent)" }} />
      <div className="reply__text" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 2 }}>Suggested reply</div>
        {text}
      </div>
      <button className="btn reply__copy" onClick={copy} style={{ fontSize: 11.5 }} title="Copy reply">
        <CopyIcon size={12} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

/** "Edit & take": adjust what goes into the Planner task before it's created. */
function TakeEditor({
  item,
  briefTitle,
  onSubmit,
  onCancel,
}: {
  item: BriefItem;
  briefTitle?: string;
  onSubmit: (edit: TakeEdit) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [due, setDue] = useState(plannerDue(item) ?? "");
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [body, setBody] = useState(plannerNotesBody(item));
  const label = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" } as const;

  return (
    <form
      className="reply"
      style={{ flex: "1 1 100%", flexDirection: "column", alignItems: "stretch", gap: 12, padding: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, body, due, priority });
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
        <SparklesIcon size={15} />
        Edit before adding to your Planner
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={label}>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 160px" }}>
          <span style={label}>Due date</span>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 160px" }}>
          <span style={label}>Priority</span>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {cap(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={label}>Notes for the Planner task — edit the AI's text freely</span>
        <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(10, Math.max(4, body.split("\n").length + 1))} style={{ resize: "vertical", lineHeight: 1.5 }} />
        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
          Added automatically as the last line: <code>{notesFooter(item, briefTitle)}</code>
        </span>
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Add to Planner
          <ArrowRightIcon size={13} />
        </button>
      </div>
    </form>
  );
}
