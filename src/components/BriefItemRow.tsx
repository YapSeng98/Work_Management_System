import { useState } from "react";
import { quadrantLabel, quadrantStyle } from "../quadrant";
import type { BriefItem } from "../lib/brief";
import { ArrowRightIcon, CheckIcon, CopyIcon, SparklesIcon, XIcon } from "./icons";
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
  onTake,
  onDismiss,
}: {
  item: BriefItem;
  isLast?: boolean;
  status: ItemStatus;
  since?: string;
  onTake?: () => void;
  onDismiss?: () => void;
}) {
  const q = quadrantStyle[item.quadrant];
  const taken = status === "taken";

  return (
    <div className="item" style={{ opacity: taken ? 0.62 : 1 }}>
      <span className="item__bar" style={{ background: q.text }} />
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Pill dot label={quadrantLabel[item.quadrant]} bg={q.bg} color={q.text} />
          {item.kind !== "fyi" && <Pill label={cap(item.priority)} {...priorityStyle[item.priority]} />}
          {item.topRank && <Pill label={`Top ${item.topRank}`} bg="var(--accent-tint)" color="var(--accent)" />}
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
        {item.suggestedReply && <SuggestedReply text={item.suggestedReply} />}
      </div>

      {onTake && (
        <div style={{ display: "flex", gap: 6, flex: "none", alignItems: "center" }}>
          {taken ? (
            <button className="btn btn-done" disabled title="Already a task in your Planner">
              <CheckIcon size={13} />
              In My Tasks
            </button>
          ) : (
            <button className={status === "done" ? "btn" : "btn btn-primary"} onClick={onTake} title="Create this as a task in your Planner">
              {status === "done" ? "Take again" : "Take"}
              <ArrowRightIcon size={13} />
            </button>
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 2 }}>Suggested reply</div>
        {text}
      </div>
      <button className="btn" onClick={copy} style={{ padding: "4px 10px", fontSize: 11.5 }} title="Copy reply">
        <CopyIcon size={12} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
