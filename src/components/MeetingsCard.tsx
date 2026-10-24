import { Card, SectionHeader } from "./Card";
import { CalendarIcon } from "./icons";
import type { Meeting } from "../types";

export function MeetingsCard({ meetings }: { meetings: Meeting[] }) {
  return (
    <Card>
      <SectionHeader icon={<CalendarIcon size={15} />} label="Meetings" count={meetings.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {meetings.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, background: "var(--divider)" }}>
            <span
              className="chip"
              style={{ background: "var(--schedule-bg)", color: "var(--schedule-text)", fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {m.time || "—"}
            </span>
            <div style={{ fontSize: 13.5 }}>{m.title}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
