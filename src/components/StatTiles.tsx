function Tile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? "var(--accent-tint)" : "var(--card)",
        border: `1px solid ${accent ? "var(--accent-tint-border)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 12, color: accent ? "var(--accent)" : "var(--text-faint)", letterSpacing: "0.03em" }}>
        {label}
      </div>
    </div>
  );
}

export function StatTiles({
  meetings,
  unread,
  flagged,
  freeHours,
}: {
  meetings: number;
  unread: number;
  flagged: number;
  freeHours: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
      <Tile value={String(meetings)} label="meetings today" />
      <Tile value={String(unread)} label="unread emails" />
      <Tile value={String(flagged)} label="flagged for you" />
      <Tile value={`${freeHours}h`} label="free between meetings" accent />
    </div>
  );
}
