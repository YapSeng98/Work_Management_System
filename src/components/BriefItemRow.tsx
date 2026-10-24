import { quadrantLabel, quadrantStyle } from "../quadrant";
import type { BriefItem } from "../lib/brief";
import { CheckIcon, XIcon } from "./icons";
import { Pill } from "./Pill";

const priorityStyle = {
  critical: { bg: "var(--do-text)", color: "#fff" },
  high: { bg: "var(--badge-urgent-bg)", color: "var(--badge-urgent-text)" },
  medium: { bg: "var(--badge-warn-bg)", color: "var(--badge-warn-text)" },
  low: { bg: "var(--later-bg)", color: "var(--later-text)" },
};

/** new = not taken; taken = an open task covers it; done = taken before and completed. */
export type ItemStatus = "new" | "taken" | "done";

const kindLabel = {
  reply: "Needs reply",
  action: "Action required",
  decision: "Decision required",
  follow_up: "Follow up",
  fyi: "FYI",
};

export function BriefItemRow({
  item,
  isLast,
  status,
  since,
  onTake,
  onDismiss,
}: {
  item: BriefItem;
  isLast: boolean;
  status: ItemStatus;
  since?: string;
  onTake?: () => void;
  onDismiss?: () => void;
}) {
  const q = quadrantStyle[item.quadrant];
  const taken = status === "taken";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        alignItems: "flex-start",
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid var(--divider)",
        opacity: taken ? 0.6 : 1,
      }}
    >
      <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Pill label={quadrantLabel[item.quadrant].toUpperCase()} bg={q.bg} color={q.text} />
          {item.kind !== "fyi" && <Pill label={item.priority.toUpperCase()} {...priorityStyle[item.priority]} />}
          {item.topRank && <Pill label={`TOP #${item.topRank}`} bg="var(--accent-tint)" color="var(--accent)" />}
          {item.escalation && <Pill label="ESCALATION" bg="var(--do-text)" color="#fff" />}
          {(item.risk === "critical" || item.risk === "high") && (
            <Pill label={`RISK ${item.risk.toUpperCase()}`} {...priorityStyle[item.risk === "critical" ? "high" : "medium"]} />
          )}
          {item.personal && <Pill label="FOR YOU" bg="var(--schedule-bg)" color="var(--schedule-text)" />}
          {item.waitingSince && <Pill label={`WAITING SINCE ${item.waitingSince.toUpperCase()}`} bg="var(--badge-warn-bg)" color="var(--badge-warn-text)" />}
          {item.waitingOnCustomer && <Pill label="AWAITING CUSTOMER" bg="var(--delegate-bg)" color="var(--delegate-text)" />}
          {item.canClose && <Pill label="CAN CLOSE" bg="var(--later-bg)" color="var(--later-text)" />}
          {item.due && <Pill label={`DUE ${item.due.toUpperCase()}`} bg="var(--badge-urgent-bg)" color="var(--badge-urgent-text)" />}
          {since && <Pill label={`PENDING SINCE ${since.toUpperCase()}`} bg="var(--badge-warn-bg)" color="var(--badge-warn-text)" />}
          {status === "done" && <Pill label="DONE BEFORE" bg="var(--later-bg)" color="var(--later-text)" />}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, overflowWrap: "anywhere" }}>{item.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {[
            item.customer,
            item.ownerName && `owner: ${item.ownerName}`,
            item.from && `last from ${item.from}`,
            kindLabel[item.kind],
            item.stage && `stage: ${item.stage}`,
            item.ownerName && item.ownerReason.startsWith("Owned by") ? undefined : item.ownerReason,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {item.status && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-faint)" }}>Status:</span> {item.status}
          </div>
        )}
        {item.summary && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.summary}</div>}
        {item.action && (
          <div style={{ fontSize: 13, color: "var(--text)" }}>
            <strong>→</strong> {item.action}
          </div>
        )}
        {item.timeline && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>⏱ {item.timeline}</div>}
        {item.suggestedReply && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              background: "var(--bg)",
              borderLeft: "3px solid var(--schedule-text)",
              borderRadius: 4,
              padding: "6px 10px",
            }}
          >
            <span style={{ color: "var(--schedule-text)", fontWeight: 600 }}>Suggested reply:</span> {item.suggestedReply}
          </div>
        )}
      </div>

      {onTake && (
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button
            onClick={onTake}
            disabled={taken}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              background: taken ? "var(--card)" : "var(--text)",
              color: taken ? "var(--text-faint)" : "var(--bg)",
              padding: "8px 14px",
              borderRadius: 7,
              border: taken ? "1px solid var(--border)" : "none",
              cursor: taken ? "default" : "pointer",
            }}
          >
            <CheckIcon size={13} color={taken ? "var(--text-faint)" : "var(--bg)"} />
            {taken ? "In My Tasks" : status === "done" ? "Take again" : "Take"}
          </button>
          {!taken && onDismiss && (
            <button
              onClick={onDismiss}
              title="Dismiss"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                border: "1px solid var(--border)",
                borderRadius: 7,
                background: "var(--card)",
                color: "var(--text-faint)",
              }}
            >
              <XIcon size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
