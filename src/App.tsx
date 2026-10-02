import { useEffect, useState } from "react";
import "./styles/global.css";

import { Header } from "./components/Header";
import { StatTiles } from "./components/StatTiles";
import { MeetingsCard } from "./components/MeetingsCard";
import { FlaggedCard } from "./components/FlaggedCard";
import { AwaitingReplyCard } from "./components/AwaitingReplyCard";
import { Card, SectionHeader } from "./components/Card";
import { ListChecksIcon } from "./components/icons";
import { CandidateTaskRow } from "./components/CandidateTaskRow";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { HistoryView } from "./components/HistoryView";

import { seedHistory } from "./data/mock";
import { fetchDigest } from "./api/digestClient";
import { candidateToCreateInput, createTaskInPlanner } from "./api/plannerClient";
import { HIDE_FOREVER, isHidden, loadHistory, loadTriage, saveHistory, saveTriage, type TriageState } from "./lib/storage";
import type { CandidateTask, Digest, HistoryEntry, Quadrant } from "./types";

type Tab = "today" | "history";

function nowTime() {
  return new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Local-time ISO date (toISOString() would give the UTC date, wrong before 8am in UTC+8). */
function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso() {
  return isoDate(new Date());
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [triage, setTriage] = useState<TriageState>(loadTriage);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(seedHistory));
  const [confirming, setConfirming] = useState<CandidateTask | null>(null);

  useEffect(() => saveTriage(triage), [triage]);
  useEffect(() => saveHistory(history), [history]);

  function load() {
    fetchDigest()
      .then(setDigest)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }

  function retry() {
    setLoadError(null);
    load();
  }

  useEffect(load, []);

  const today = todayIso();
  const candidates = digest ? digest.candidateTasks.filter((c) => !isHidden(triage, c.id, today)) : [];

  function logHistory(entry: Omit<HistoryEntry, "id" | "date" | "time">) {
    setHistory((prev) => [
      { ...entry, id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: todayIso(), time: nowTime() },
      ...prev,
    ]);
  }

  function hideCandidate(id: string, until: string) {
    setTriage((prev) => ({ ...prev, [id]: until }));
  }

  function handleSnooze(task: CandidateTask) {
    hideCandidate(task.id, tomorrowIso());
    logHistory({ title: task.title, action: "snoozed" });
  }

  function handleDismiss(task: CandidateTask) {
    hideCandidate(task.id, HIDE_FOREVER);
    logHistory({ title: task.title, action: "dismissed" });
  }

  async function handleConfirm(edited: { title: string; quadrant: Quadrant; due: string; project: string }) {
    if (!confirming) return;
    const input = candidateToCreateInput(confirming, edited);
    await createTaskInPlanner(input); // throws on failure; ConfirmDialog shows the error and stays open
    hideCandidate(confirming.id, HIDE_FOREVER);
    logHistory({ title: edited.title, action: "added", quadrant: edited.quadrant });
    setConfirming(null);
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "clamp(16px, 5vw, 48px)",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 28 }}>
        <Header tab={tab} onTabChange={setTab} syncedAt={digest?.syncedAt ?? "—"} />

        {tab === "history" ? (
          <HistoryView entries={history} />
        ) : loadError ? (
          <Card>
            <div style={{ fontSize: 14, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 12 }}>
              Couldn't load today's brief: {loadError}
              <button onClick={retry} style={{ fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "1.5px solid var(--border)", background: "var(--card)" }}>
                Retry
              </button>
            </div>
          </Card>
        ) : !digest ? (
          <div style={{ fontSize: 14, color: "var(--text-faint)" }}>Loading today's brief…</div>
        ) : (
          <>
            <StatTiles
              meetings={digest.meetings.length}
              unread={digest.unreadCount}
              flagged={digest.flagged.length}
              freeHours={digest.freeHoursToday}
            />
            <MeetingsCard meetings={digest.meetings} />
            <FlaggedCard items={digest.flagged} />
            <AwaitingReplyCard items={digest.awaitingReply} />

            <Card>
              <SectionHeader icon={<ListChecksIcon />} label="Candidate Tasks" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                {candidates.map((task, i) => (
                  <CandidateTaskRow
                    key={task.id}
                    task={task}
                    isLast={i === candidates.length - 1}
                    onAdd={() => setConfirming(task)}
                    onSnooze={() => handleSnooze(task)}
                    onDismiss={() => handleDismiss(task)}
                  />
                ))}
                {candidates.length === 0 && (
                  <div style={{ fontSize: 14, color: "var(--text-faint)", padding: "14px 0" }}>
                    Nothing left to triage — nice work.
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog task={confirming} onCancel={() => setConfirming(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
