import { useEffect, useMemo, useState } from "react";
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
import { BriefImportCard } from "./components/BriefImportCard";
import { BriefView } from "./components/BriefView";
import { MyTasksView } from "./components/MyTasksView";

import { seedHistory } from "./data/mock";
import { fetchDigest } from "./api/digestClient";
import { candidateToCreateInput, createTaskInPlanner } from "./api/plannerClient";
import { parseBrief, type BriefItem, type ParsedBrief } from "./lib/briefParser";
import {
  HIDE_FOREVER,
  isHidden,
  loadBriefText,
  loadHistory,
  loadMyTasks,
  loadTriage,
  saveBriefText,
  saveHistory,
  saveMyTasks,
  saveTriage,
  type TriageState,
} from "./lib/storage";
import type { CandidateTask, Digest, HistoryEntry, MyTask, Quadrant, Tab } from "./types";

/** Parse pasted brief text; null if it contains nothing recognisable. */
function analyse(text: string): ParsedBrief | null {
  if (!text.trim()) return null;
  const parsed = parseBrief(text);
  return parsed.items.length || parsed.meetings.length ? parsed : null;
}

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
  const [briefText, setBriefText] = useState<string>(loadBriefText);
  const [myTasks, setMyTasks] = useState<MyTask[]>(loadMyTasks);

  useEffect(() => saveTriage(triage), [triage]);
  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveBriefText(briefText), [briefText]);
  useEffect(() => saveMyTasks(myTasks), [myTasks]);

  const brief = useMemo(() => analyse(briefText), [briefText]);
  const takenIds = useMemo(() => new Set(myTasks.map((t) => t.id)), [myTasks]);

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

  function handleBriefText(text: string) {
    if (!analyse(text)) return false;
    setBriefText(text);
    return true;
  }

  function handleTake(item: BriefItem) {
    if (takenIds.has(item.id)) return;
    const task: MyTask = {
      id: item.id,
      title: item.title,
      quadrant: item.quadrant,
      due: item.due,
      from: item.from,
      action: item.action,
      refs: item.refs,
      takenAt: todayIso(),
      done: false,
      score: item.score,
    };
    setMyTasks((prev) => [task, ...prev]);
    logHistory({ title: item.title, action: "taken", quadrant: item.quadrant });
  }

  function handleDismissBriefItem(item: BriefItem) {
    hideCandidate(item.id, HIDE_FOREVER);
    logHistory({ title: item.title, action: "dismissed" });
  }

  function handleToggleDone(task: MyTask) {
    setMyTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    if (!task.done) logHistory({ title: task.title, action: "done", quadrant: task.quadrant });
  }

  function handleRemoveTask(task: MyTask) {
    setMyTasks((prev) => prev.filter((t) => t.id !== task.id));
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
        <Header
          tab={tab}
          onTabChange={setTab}
          taskCount={myTasks.filter((t) => !t.done).length}
          status={
            brief
              ? `brief ${brief.date?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? "loaded"}`
              : "sample data"
          }
        />

        {tab === "today" && (
          <BriefImportCard brief={brief} onText={handleBriefText} onClear={() => setBriefText("")} />
        )}

        {tab === "history" ? (
          <HistoryView entries={history} />
        ) : tab === "tasks" ? (
          <MyTasksView
            tasks={myTasks}
            onToggleDone={handleToggleDone}
            onRemove={handleRemoveTask}
            onClearDone={() => setMyTasks((prev) => prev.filter((t) => !t.done))}
          />
        ) : brief ? (
          <BriefView
            brief={brief}
            hidden={(id) => isHidden(triage, id, today)}
            takenIds={takenIds}
            onTake={handleTake}
            onDismiss={handleDismissBriefItem}
          />
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
            <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              Sample data — paste your brief above to see your own
            </div>
            <StatTiles
              tiles={[
                { value: String(digest.meetings.length), label: "meetings today" },
                { value: String(digest.unreadCount), label: "unread emails" },
                { value: String(digest.flagged.length), label: "flagged for you" },
                { value: `${digest.freeHoursToday}h`, label: "free between meetings", accent: true },
              ]}
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
