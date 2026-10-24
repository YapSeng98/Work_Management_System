export interface TileSpec {
  value: string;
  label: string;
  accent?: boolean;
}

export function StatTiles({ tiles }: { tiles: TileSpec[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`card rise${t.accent ? " card-ai" : ""}`}
          style={{ padding: "16px 18px", gap: 2, animationDelay: `${i * 50}ms` }}
        >
          <div
            className={t.accent ? "gradient-text" : undefined}
            style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {t.value}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}
