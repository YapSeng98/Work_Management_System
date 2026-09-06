import { Card, SectionHeader } from "./Card";
import { FlagIcon } from "./icons";
import type { FlaggedEmail } from "../types";

export function FlaggedCard({ items }: { items: FlaggedEmail[] }) {
  return (
    <Card>
      <SectionHeader icon={<FlagIcon />} label="Flagged" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((f, i) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              padding: "11px 0",
              borderBottom: i < items.length - 1 ? "1px solid var(--divider)" : "none",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, width: 140, flex: "none" }}>{f.sender}</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", flex: 1 }}>{f.subject}</div>
            {f.badge === "to-you" ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  background: "var(--text)",
                  color: "var(--bg)",
                  padding: "4px 8px",
                  borderRadius: 5,
                  flex: "none",
                }}
              >
                TO YOU
              </span>
            ) : (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  border: "1px solid #cfccc2",
                  color: "var(--text-faint)",
                  padding: "3px 7px",
                  borderRadius: 5,
                  flex: "none",
                }}
              >
                MENTIONED
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
