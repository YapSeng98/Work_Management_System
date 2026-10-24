import { useEffect, useMemo, useRef, useState } from "react";

import { Header } from "./components/Header";
import { Card } from "./components/Card";
import { HistoryView, type BriefSummary } from "./components/HistoryView";
import { BriefImportCard } from "./components/BriefImportCard";
import { BriefView } from "./components/BriefView";
import { MyTasksView } from "./components/MyTasksView";
import type { ItemStatus } from "./components/BriefItemRow";
import { XIcon } from "./components/icons";

import { parseBrief, type BriefItem, type ParsedBrief } from "./lib/brief";
import * as db from "./lib/db";
import type { HistoryAction, HistoryEntry, MyTask, Quadrant, Tab } from "./types";

/** Parse pasted brief text; null if it contains nothing recognisable. */
function analyse(text: string): ParsedBrief | null {
  if (!text.trim()) return null;
  const parsed = parseBrief(text);
  return parsed.items.length || parsed.meetings.length ? parsed : null;
}

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The signed-in app. Every change is written to Supabase before the UI updates,
 * and a live subscription refetches whenever data changes anywhere (other tab,
 * other device), so every view always reflects what's stored.
 */
export function Workspace({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<db.StoredBrief[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null); // null = latest brief
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inFlight = useRef(new Set<string>()); // item keys being saved, to ignore double clicks

  useEffect(() => {
    Promise.all([db.fetchBriefs(), db.fetchTasks(), db.fetchDismissed(), db.fetchHistory()])
      .then(([b, t, d, h]) => {
        setBriefs(b);
        setTasks(t);
        setDismissed(d);
        setHistory(h);
      })
      .catch((err: unknown) => setError(`Couldn't load your data: ${message(err)}`))
      .finally(() => setLoading(false));

    // Live updates: refetch a table shortly after it changes (batches bursts of events).
    const loaders: Record<db.Table, () => Promise<void>> = {
      briefs: () => db.fetchBriefs().then(setBriefs),
      tasks: () => db.fetchTasks().then(setTasks),
      dismissed_items: () => db.fetchDismissed().then(setDismissed),
      history: () => db.fetchHistory().then(setHistory),
    };
    const timers = new Map<db.Table, ReturnType<typeof setTimeout>>();
    const unsubscribe = db.subscribeToChanges((table) => {
      clearTimeout(timers.get(table));
      timers.set(
        table,
        setTimeout(() => loaders[table]().catch((err: unknown) => setError(`Live update failed: ${message(err)}`)), 200),
      );
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  const parsed = useMemo(() => new Map(briefs.map((b) => [b.id, analyse(b.rawText)])), [briefs]);
  const current = briefs.find((b) => b.id === viewingId) ?? briefs[0] ?? null;
  const brief = current ? (parsed.get(current.id) ?? null) : null;

  // Earliest brief each ticket appeared in, to show how long an item has been pending.
  const firstSeen = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of briefs) {
      for (const item of parsed.get(b.id)?.items ?? []) {
        for (const ref of item.refs) {
          const prev = seen.get(ref);
          if (!prev || b.briefDate < prev) seen.set(ref, b.briefDate);
        }
      }
    }
    return seen;
  }, [briefs, parsed]);

  /** An open task covers an item if it came from the same item or shares a ticket number. */
  function openTaskFor(item: BriefItem) {
    return tasks.find((t) => !t.done && (t.itemKey === item.id || t.refs.some((r) => item.refs.includes(r))));
  }

  function statusOf(item: BriefItem): ItemStatus {
    if (openTaskFor(item)) return "taken";
    return tasks.some((t) => t.itemKey === item.id && t.done) ? "done" : "new";
  }

  function sinceOf(item: BriefItem) {
    if (!current) return undefined;
    const dates = item.refs.map((r) => firstSeen.get(r)).filter((d): d is string => d !== undefined);
    const earliest = dates.sort()[0];
    return earliest && earliest < current.briefDate ? shortDate(earliest) : undefined;
  }

  const briefSummaries: BriefSummary[] = briefs.map((b) => {
    const p = parsed.get(b.id);
    return {
      id: b.id,
      title: b.title,
      briefDate: b.briefDate,
      mine: p?.items.filter((i) => i.owner === "me").length ?? 0,
      chase: p?.items.filter((i) => i.owner === "others").length ?? 0,
      meetings: p?.meetings.length ?? 0,
      isCurrent: b.id === current?.id,
    };
  });

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
      const saved = await db.insertBrief(text, parsed.title, parsed.date);
      setBriefs((prev) => [saved, ...prev.filter((b) => b.id !== saved.id)]);
      setViewingId(null);
    });
    return true;
  }

  function handleClearBrief() {
    if (!current || !window.confirm("Delete this brief from Supabase? Your tasks and history are kept.")) return;
    const id = current.id;
    void run(async () => {
      await db.deleteBrief(id);
      setBriefs((prev) => prev.filter((b) => b.id !== id));
      setViewingId(null);
    });
  }

  function handleTake(item: BriefItem) {
    if (openTaskFor(item) || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    const doneBefore = tasks.find((t) => t.itemKey === item.id && t.done);
    void run(async () => {
      if (doneBefore) {
        // Same item came back after being completed — reopen the existing task.
        await db.setTaskDone(doneBefore.id, false);
        setTasks((prev) => prev.map((t) => (t.id === doneBefore.id ? { ...t, done: false } : t)));
      } else {
        const task = await db.insertTask(item, current?.id ?? null);
        setTasks((prev) => [task, ...prev]);
      }
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
          <HistoryView
            entries={history}
            briefs={briefSummaries}
            openTasks={tasks.filter((t) => !t.done).length}
            onViewBrief={(id) => {
              setViewingId(id);
              setTab("today");
            }}
          />
        ) : tab === "tasks" ? (
          <MyTasksView tasks={tasks} onToggleDone={handleToggleDone} onRemove={handleRemoveTask} onClearDone={handleClearDone} />
        ) : (
          <>
            {current && current.id !== briefs[0]?.id && (
              <Card>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 14, color: "var(--text-muted)" }}>
                  <div style={{ flex: 1 }}>
                    Viewing a past brief from <strong style={{ color: "var(--text)" }}>{shortDate(current.briefDate)}</strong>.
                  </div>
                  <button
                    onClick={() => setViewingId(null)}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--text-muted)" }}
                  >
                    Back to latest
                  </button>
                </div>
              </Card>
            )}
            <BriefImportCard brief={brief} onText={handleBriefText} onClear={handleClearBrief} />
            {brief && (
              <BriefView
                brief={brief}
                hidden={(id) => dismissed.has(id)}
                statusOf={statusOf}
                sinceOf={sinceOf}
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
