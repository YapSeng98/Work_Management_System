export function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.03em",
        color,
        background: bg,
        padding: "3px 8px",
        borderRadius: 5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
