import { useEffect, useMemo, useRef, useState } from "react";

import { Header } from "./components/Header";
import { Card } from "./components/Card";
import { HistoryView } from "./components/HistoryView";
import { BriefImportCard } from "./components/BriefImportCard";
import { BriefView } from "./components/BriefView";
import { MyTasksView } from "./components/MyTasksView";
import { XIcon } from "./components/icons";

import { parseBrief, type BriefItem, type ParsedBrief } from "./lib/briefParser";
import * as db from "./lib/db";
import type { HistoryAction, HistoryEntry, MyTask, Quadrant, Tab } from "./types";

/** Parse pasted brief text; null if it contains nothing recognisable. */
function analyse(text: string): ParsedBrief | null {
  if (!text.trim()) return null;
  const parsed = parseBrief(text);
  return parsed.items.length || parsed.meetings.length ? parsed : null;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/** The signed-in app. Every change is written to Supabase before the UI updates. */
export function Workspace({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storedBrief, setStoredBrief] = useState<db.StoredBrief | null>(null);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inFlight = useRef(new Set<string>()); // item keys being saved, to ignore double clicks

  useEffect(() => {
    Promise.all([db.fetchLatestBrief(), db.fetchTasks(), db.fetchDismissed(), db.fetchHistory()])
      .then(([b, t, d, h]) => {
        setStoredBrief(b);
        setTasks(t);
        setDismissed(d);
        setHistory(h);
      })
      .catch((err: unknown) => setError(`Couldn't load your data: ${message(err)}`))
      .finally(() => setLoading(false));
  }, []);

  const brief = useMemo(() => (storedBrief ? analyse(storedBrief.rawText) : null), [storedBrief]);
  const takenKeys = useMemo(() => new Set(tasks.map((t) => t.itemKey)), [tasks]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    }
  }

  async function log(action: HistoryAction, title: string, quadrant?: Quadrant) {
    const entry = await db.insertHistory(action, title, quadrant);
    setHistory((prev) => [entry, ...prev]);
  }

  function handleBriefText(text: string) {
    const parsed = analyse(text);
    if (!parsed) return false;
    void run(async () => {
      setStoredBrief(await db.insertBrief(text, parsed.title, parsed.date));
    });
    return true;
  }

  function handleClearBrief() {
    if (!storedBrief || !window.confirm("Delete this brief from Supabase? Your tasks and history are kept.")) return;
    const id = storedBrief.id;
    void run(async () => {
      await db.deleteBrief(id);
      setStoredBrief(null);
    });
  }

  function handleTake(item: BriefItem) {
    if (takenKeys.has(item.id) || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    void run(async () => {
      const task = await db.insertTask(item, storedBrief?.id ?? null);
      setTasks((prev) => [task, ...prev]);
      await log("taken", item.title, item.quadrant);
    }).finally(() => inFlight.current.delete(item.id));
  }

  function handleDismiss(item: BriefItem) {
    void run(async () => {
      await db.insertDismissed(item.id, item.title);
      setDismissed((prev) => new Set(prev).add(item.id));
      await log("dismissed", item.title);
    });
  }

  function handleToggleDone(task: MyTask) {
    void run(async () => {
      await db.setTaskDone(task.id, !task.done);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
      if (!task.done) await log("done", task.title, task.quadrant);
    });
  }

  function handleRemoveTask(task: MyTask) {
    void run(async () => {
      await db.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    });
  }

  function handleClearDone() {
    void run(async () => {
      await db.deleteDoneTasks();
      setTasks((prev) => prev.filter((t) => !t.done));
    });
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
          taskCount={tasks.filter((t) => !t.done).length}
          email={email}
          onSignOut={onSignOut}
          status={
            brief
              ? `brief ${brief.date?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? "loaded"}`
              : "no brief yet"
          }
        />

        {error && (
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14, color: "var(--do-text)" }}>
              <div style={{ flex: 1 }}>{error}</div>
              <button onClick={() => setError(null)} title="Dismiss" style={{ background: "none", border: "none", color: "var(--text-faint)" }}>
                <XIcon size={13} />
              </button>
            </div>
          </Card>
        )}

        {loading ? (
          <div style={{ fontSize: 14, color: "var(--text-faint)" }}>Loading your data…</div>
        ) : tab === "history" ? (
          <HistoryView entries={history} />
        ) : tab === "tasks" ? (
          <MyTasksView tasks={tasks} onToggleDone={handleToggleDone} onRemove={handleRemoveTask} onClearDone={handleClearDone} />
        ) : (
          <>
            <BriefImportCard brief={brief} onText={handleBriefText} onClear={handleClearBrief} />
            {brief && (
              <BriefView
                brief={brief}
                hidden={(id) => dismissed.has(id)}
                takenIds={takenKeys}
                onTake={handleTake}
                onDismiss={handleDismiss}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
