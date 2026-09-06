import { useState } from "react";
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

import { mockDigest, seedHistory } from "./data/mock";
import { candidateToCreateInput, createTaskInPlanner } from "./api/plannerClient";
import type { CandidateTask, HistoryEntry, Quadrant } from "./types";

type Tab = "today" | "history";

function nowTime() {
  return new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [candidates, setCandidates] = useState<CandidateTask[]>(mockDigest.candidateTasks);
  const [history, setHistory] = useState<HistoryEntry[]>(seedHistory);
  const [confirming, setConfirming] = useState<CandidateTask | null>(null);

  function logHistory(entry: Omit<HistoryEntry, "id" | "date" | "time">) {
    setHistory((prev) => [
      { ...entry, id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: todayIso(), time: nowTime() },
      ...prev,
    ]);
  }

  function removeCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  function handleSnooze(task: CandidateTask) {
    removeCandidate(task.id);
    logHistory({ title: task.title, action: "snoozed" });
  }

  function handleDismiss(task: CandidateTask) {
    removeCandidate(task.id);
    logHistory({ title: task.title, action: "dismissed" });
  }

  async function handleConfirm(edited: { title: string; quadrant: Quadrant; due: string; project: string }) {
    if (!confirming) return;
    const input = candidateToCreateInput(confirming, edited);
    await createTaskInPlanner(input);
    removeCandidate(confirming.id);
    logHistory({ title: edited.title, action: "added", quadrant: edited.quadrant });
    setConfirming(null);
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "48px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 28 }}>
        <Header tab={tab} onTabChange={setTab} syncedAt={mockDigest.syncedAt} />

        {tab === "today" ? (
          <>
            <StatTiles
              meetings={mockDigest.meetings.length}
              unread={mockDigest.unreadCount}
              flagged={mockDigest.flagged.length}
              freeHours={mockDigest.freeHoursToday}
            />
            <MeetingsCard meetings={mockDigest.meetings} />
            <FlaggedCard items={mockDigest.flagged} />
            <AwaitingReplyCard items={mockDigest.awaitingReply} />

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
        ) : (
          <HistoryView entries={history} />
        )}
      </div>

      {confirming && (
        <ConfirmDialog task={confirming} onCancel={() => setConfirming(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
