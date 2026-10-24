import { useState } from "react";
import { AI_INSTRUCTIONS, type ParsedBrief } from "../lib/brief";
import { Card, SectionHeader } from "./Card";
import { MailIcon } from "./icons";

const buttonStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: 7,
  border: "1.5px solid var(--border)",
  background: "var(--card)",
  color: "var(--text-muted)",
};

/**
 * Paste box for the daily brief. Analysis happens as soon as text is pasted
 * or typed — there's no "Analyse" button. Once a brief is loaded the box
 * collapses to a one-line summary.
 */
export function BriefImportCard({
  brief,
  onText,
  onClear,
}: {
  brief: ParsedBrief | null;
  onText: (text: string) => boolean;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(AI_INSTRUCTIONS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy these instructions and add them to the end of your AI prompt:", AI_INSTRUCTIONS);
    }
  }

  function handleChange(text: string) {
    setDraft(text);
    if (!text.trim()) {
      setError(null);
      return;
    }
    if (onText(text)) {
      setDraft("");
      setError(null);
      setEditing(false);
    } else {
      setError("Couldn't find any items in this text — paste the full Daily Work Brief, including the section headings.");
    }
  }

  const open = !brief || editing;
  const mine = brief?.items.filter((i) => i.owner === "me").length ?? 0;
  const team = brief?.items.filter((i) => i.owner === "team").length ?? 0;
  const chase = brief?.items.filter((i) => i.owner === "others").length ?? 0;

  return (
    <Card>
      <SectionHeader
        icon={<MailIcon size={14} />}
        label="Paste brief"
        right={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <button
              style={buttonStyle}
              onClick={copyInstructions}
              title="Add these to the end of your AI prompt so the report includes data this app reads exactly"
            >
              {copied ? "Copied ✓" : "Copy AI instructions"}
            </button>
            {brief && (
              <>
                <button style={buttonStyle} onClick={() => setEditing((e) => !e)}>
                  {editing ? "Cancel" : "Paste new brief"}
                </button>
                <button style={buttonStyle} onClick={onClear}>
                  Clear
                </button>
              </>
            )}
          </div>
        }
      />
      {brief && !editing && (
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{brief.title}</strong> — {mine} pending you,
          {team ? ` ${team} owned by your team,` : ""} {chase} waiting on others
          {brief.meetings.length ? `, ${brief.meetings.length} meetings` : ""}.
          <span style={{ color: "var(--text-faint)" }}>
            {" "}
            {brief.format === "json" ? "Read from the structured data block." : "Read from the report text."}
          </span>
        </div>
      )}
      {open && (
        <>
          <textarea
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste today's Daily Work Brief here — it's analysed automatically and saved to your account."
            rows={6}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13.5,
              fontFamily: "inherit",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          {error && <div style={{ fontSize: 13, color: "var(--do-text)" }}>{error}</div>}
        </>
      )}
    </Card>
  );
}
