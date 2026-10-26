import { useState } from "react";
import type { ParsedBrief } from "../lib/brief";
import type { SavedPrompt } from "../lib/db";
import { Card, SectionHeader } from "./Card";
import { BookIcon, CopyIcon, SparklesIcon } from "./icons";
import { Pill } from "./Pill";

/**
 * Paste box for the daily brief. Analysis happens as soon as text is pasted
 * or typed — there's no "Analyse" button. Once a brief is loaded the box
 * collapses to a one-line summary.
 */
export function BriefImportCard({
  brief,
  prompt,
  onText,
  onClear,
  onOpenPrompt,
}: {
  brief: ParsedBrief | null;
  prompt: SavedPrompt | null;
  onText: (text: string) => boolean;
  onClear: () => void;
  onOpenPrompt: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    if (!prompt?.text) return onOpenPrompt(); // nothing saved yet — open the editor instead
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your prompt:", prompt.text);
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

  const formatLabel = { json: "Structured data", ownership: "Ownership report", priority: "Priority report", executive: "Executive report", daily: "Daily brief" };

  return (
    <Card ai={open}>
      <SectionHeader
        ai
        icon={<SparklesIcon size={15} />}
        label={open ? "Paste your brief" : "Today's brief"}
        hint={open ? "AI sorts it instantly: yours, your team's, and waiting on customer. Nothing to click." : undefined}
        right={
          <div className="section-actions" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            <button className="btn" onClick={copyPrompt} title={prompt?.text ? "Copy your saved AI prompt" : "Save your AI prompt first"}>
              <CopyIcon size={13} />
              {copied ? "Copied ✓" : "Copy my prompt"}
            </button>
            <button className="btn" onClick={onOpenPrompt} title="View or edit your saved AI prompt">
              <BookIcon size={13} />
              My prompt
            </button>
            {brief && (
              <>
                <button className="btn" onClick={() => setEditing((e) => !e)}>
                  {editing ? "Cancel" : "Paste new brief"}
                </button>
                <button className="btn" onClick={onClear}>
                  Clear
                </button>
              </>
            )}
          </div>
        }
      />
      {brief && !editing && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{brief.title}</span>
          <Pill dot label={`${mine} pending you`} bg="var(--do-bg)" color="var(--do-text)" />
          {team > 0 && <Pill dot label={`${team} your team`} bg="var(--delegate-bg)" color="var(--delegate-text)" />}
          <Pill dot label={`${chase} waiting on others`} bg="var(--schedule-bg)" color="var(--schedule-text)" />
          {brief.meetings.length > 0 && <Pill dot label={`${brief.meetings.length} meetings`} bg="var(--later-bg)" color="var(--later-text)" />}
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>· read from {formatLabel[brief.format].toLowerCase()}</span>
        </div>
      )}
      {open && (
        <>
          <div className="composer">
            <textarea
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Paste today's brief from your AI assistant here…"
              rows={6}
              autoFocus={editing}
            />
          </div>
          {error && <div style={{ fontSize: 13, color: "var(--do-text)" }}>{error}</div>}
        </>
      )}
    </Card>
  );
}
