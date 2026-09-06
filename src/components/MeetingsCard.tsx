import { Card, SectionHeader } from "./Card";
import { CalendarIcon } from "./icons";
import type { Meeting } from "../types";

export function MeetingsCard({ meetings }: { meetings: Meeting[] }) {
  return (
    <Card>
      <SectionHeader icon={<CalendarIcon />} label="Meetings" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {meetings.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              gap: 16,
              padding: "11px 0",
              borderBottom: i < meetings.length - 1 ? "1px solid var(--divider)" : "none",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-faint)", width: 64, flex: "none" }}>
              {m.time}
            </div>
            <div style={{ fontSize: 14 }}>{m.title}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
