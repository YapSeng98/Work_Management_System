import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

/** Glass card. `ai` adds the gradient border used for AI-generated content. */
export function Card({ children, ai, style }: PropsWithChildren<{ ai?: boolean; style?: CSSProperties }>) {
  return (
    <div className={`card rise${ai ? " card-ai" : ""}`} style={style}>
      {children}
    </div>
  );
}

export function SectionHeader({
  icon,
  label,
  right,
  count,
  ai,
  hint,
}: {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  count?: number;
  ai?: boolean;
  hint?: string;
}) {
  return (
    <div className="section-title">
      <div className="section-title__label">
        <span className={`icon-tile${ai ? " icon-tile--ai" : ""}`}>{icon}</span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span>{label}</span>
          {hint && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-faint)" }}>{hint}</span>}
        </div>
      </div>
      {right ?? (count !== undefined && <span className="count">{count}</span>)}
    </div>
  );
}
