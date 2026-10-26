import { useState } from "react";
import type { SavedPrompt } from "../lib/db";
import { PROMPT_TEMPLATE, hasDataSection, withDataSection } from "../lib/prompt";
import { Card, SectionHeader } from "./Card";
import { BookIcon, CopyIcon } from "./icons";

/**
 * The user's own AI prompt, saved to their account so it can be copied from any
 * device each morning. Opens straight into editing (with the starter template) until
 * a prompt has been saved.
 */
export function PromptPanel({
  saved,
  onSave,
  onClose,
}: {
  saved: SavedPrompt;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(!saved.text);
  const [draft, setDraft] = useState(saved.text || PROMPT_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = saved.text;
  const placeholders = (editing ? draft : text).match(/<[A-Z][A-Z /]+>/g);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your prompt:", text);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      // the error banner explains; keep editing so nothing is lost
    } finally {
      setBusy(false);
    }
  }

  const when = saved.updatedAt
    ? new Date(saved.updatedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <Card ai>
      <SectionHeader
        ai
        icon={<BookIcon size={15} />}
        label="My AI prompt"
        hint={
          editing
            ? "Paste or edit your prompt, then save. It's kept in your account so you can copy it from any device."
            : `Saved${when ? ` ${when}` : ""}${saved.where === "browser" ? " · in this browser only" : " · in your account"}`
        }
        right={
          <button className="btn" onClick={onClose}>
            Close
          </button>
        }
      />

      {editing ? (
        <>
          <textarea
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            spellCheck={false}
            style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.55 }}
          />
          {placeholders && (
            <div style={{ fontSize: 12.5, color: "var(--badge-warn-text)" }}>
              Fill in the placeholders first: {[...new Set(placeholders)].join(", ")}
            </div>
          )}
          {!hasDataSection(draft) && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Tip: add the app's data section so briefs are read exactly.{" "}
              <button className="btn" style={{ marginLeft: 6 }} onClick={() => setDraft(withDataSection(draft))}>
                Add data section
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {!text && (
              <button className="btn" onClick={() => setDraft(PROMPT_TEMPLATE)} title="Start again from the generic template">
                Reset to template
              </button>
            )}
            {text && (
              <button
                className="btn"
                onClick={() => {
                  setDraft(text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn btn-primary" onClick={save} disabled={busy || !draft.trim()}>
              {busy ? "Saving…" : "Save prompt"}
            </button>
          </div>
        </>
      ) : (
        <>
          <pre
            style={{
              margin: 0,
              maxHeight: 220,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              lineHeight: 1.55,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--card-solid)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {text}
          </pre>
          {!hasDataSection(text) && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              This prompt doesn't ask for the app's data section yet — edit it and click <strong>Add data section</strong> for the most reliable sorting.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-primary" onClick={copy}>
              <CopyIcon size={13} color="#fff" />
              {copied ? "Copied ✓" : "Copy prompt"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
