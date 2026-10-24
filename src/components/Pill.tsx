export function Pill({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: boolean }) {
  return (
    <span className="chip" style={{ background: bg, color }}>
      {dot && <span className="chip__dot" />}
      {label}
    </span>
  );
}
