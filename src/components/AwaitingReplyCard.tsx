import { Card, SectionHeader } from "./Card";
import { ReplyIcon } from "./icons";
import type { AwaitingReply } from "../types";

function badgeStyle(days: number) {
  if (days >= 5) return { bg: "var(--badge-urgent-bg)", text: "var(--badge-urgent-text)" };
  if (days >= 3) return { bg: "var(--badge-warn-bg)", text: "var(--badge-warn-text)" };
  return { bg: "var(--later-bg)", text: "var(--later-text)" };
}

export function AwaitingReplyCard({ items }: { items: AwaitingReply[] }) {
  return (
    <Card>
      <SectionHeader
        icon={<ReplyIcon />}
        label="Awaiting Reply"
        right={
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.03em",
              color: "var(--accent)",
              background: "var(--accent-tint)",
              padding: "3px 8px",
              borderRadius: 5,
            }}
          >
            NEW
          </span>
        }
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((a, i) => {
          const s = badgeStyle(a.daysWaiting);
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                padding: "11px 0",
                borderBottom: i < items.length - 1 ? "1px solid var(--divider)" : "none",
              }}
            >
              <div style={{ fontSize: 14, color: "var(--text-muted)", flex: 1 }}>
                You → <span style={{ fontWeight: 600, color: "var(--text)" }}>{a.recipient}</span> · "{a.subject}"
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  background: s.bg,
                  color: s.text,
                  padding: "4px 8px",
                  borderRadius: 5,
                  flex: "none",
                }}
              >
                {a.daysWaiting} {a.daysWaiting === 1 ? "DAY" : "DAYS"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
