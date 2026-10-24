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

export interface TileSpec {
  value: string;
  label: string;
  accent?: boolean;
}

export function StatTiles({ tiles }: { tiles: TileSpec[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}
