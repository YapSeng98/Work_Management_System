import { useEffect, useMemo, useRef, useState } from "react";

import { Header } from "./components/Header";
import { Card } from "./components/Card";
import { HistoryView, type BriefSummary } from "./components/HistoryView";
import { BriefImportCard } from "./components/BriefImportCard";
import { BriefView } from "./components/BriefView";
import { MyTasksView } from "./components/MyTasksView";
import { PromptPanel } from "./components/PromptPanel";
import { ArchiveView } from "./components/ArchiveView";
import type { ItemStatus } from "./components/BriefItemRow";
import { XIcon } from "./components/icons";

import { parseBrief, type BriefItem, type ParsedBrief } from "./lib/brief";
import * as db from "./lib/db";
import { taskIdFor, type TakeEdit } from "./lib/planner";
import { archivedItems, carriedOver } from "./lib/carryOver";
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
export function Workspace({ userId, email, onSignOut }: { userId: string; email: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<db.StoredBrief[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null); // null = latest brief
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [storeMode, setStoreMode] = useState<db.StoreMode>("supabase");
  const [prompt, setPrompt] = useState<db.SavedPrompt | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [taskIds, setTaskIds] = useState<Map<string, string>>(new Map()); // brief item id → Planner task id
  const inFlight = useRef(new Set<string>()); // item keys being saved, to ignore double clicks

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    const timers = new Map<db.Table, ReturnType<typeof setTimeout>>();

    // Live updates: refetch a table shortly after it changes (batches bursts of events).
    const loaders: Record<db.Table, () => Promise<void>> = {
      briefs: () => db.fetchBriefs().then(setBriefs),
      tasks: () => db.fetchTasks().then(setTasks),
      dismissed_items: () => db.fetchDismissed().then(setDismissed),
      history: () => db.fetchHistory().then(setHistory),
    };
    const subscribe = () =>
      db.subscribeToChanges((table) => {
        clearTimeout(timers.get(table));
        timers.set(
          table,
          setTimeout(() => loaders[table]().catch((err: unknown) => setError(`Live update failed: ${message(err)}`)), 200),
        );
      });
    (async () => {
      setStoreMode(await db.detectStore());
      void db.pruneOld().catch(() => {}); // housekeeping: the 30-day archive limit also applies when nobody pastes
      const [b, t, d, h, p] = await Promise.all([db.fetchBriefs(), db.fetchTasks(), db.fetchDismissed(), db.fetchHistory(), db.fetchPrompt()]);
      if (cancelled) return;
      setPrompt(p);
      setBriefs(b);
      setTasks(t);
      setDismissed(d);
      setHistory(h);
      unsubscribe = subscribe();
    })()
      .catch((err: unknown) => setError(`Couldn't load your data: ${message(err)}`))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  const parsed = useMemo(() => new Map(briefs.map((b) => [b.id, analyse(b.rawText)])), [briefs]);

  // The Planner task id each brief item would get (derived, so no link table is needed).
  useEffect(() => {
    const keys = [...new Set([...parsed.values()].flatMap((p) => p?.items.map((i) => i.id) ?? []))];
    void Promise.all(keys.map(async (k) => [k, await taskIdFor(userId, k)] as const)).then((pairs) => setTaskIds(new Map(pairs)));
  }, [parsed, userId]);
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
    const id = taskIds.get(item.id);
    return tasks.find((t) => !t.done && (t.id === id || t.refs.some((r) => item.refs.includes(r))));
  }

  function statusOf(item: BriefItem): ItemStatus {
    if (openTaskFor(item)) return "taken";
    return tasks.some((t) => t.id === taskIds.get(item.id) && t.done) ? "done" : "new";
  }

  function sinceOf(item: BriefItem) {
    if (!current) return undefined;
    const dates = item.refs.map((r) => firstSeen.get(r)).filter((d): d is string => d !== undefined);
    const earliest = dates.sort()[0];
    return earliest && earliest < current.briefDate ? shortDate(earliest) : undefined;
  }

  const snapshots = briefs.map((b) => ({ briefDate: b.briefDate, title: b.title, items: parsed.get(b.id)?.items ?? [] }));
  const archived = archivedItems(snapshots, db.KEEP_DAYS.briefs);

  // Items from earlier briefs that slipped out of today's — only on the latest brief.
  const carried =
    current && current.id === briefs[0]?.id
      ? carriedOver(snapshots).filter(
          (c) => !dismissed.has(c.item.id) && statusOf(c.item) === "new",
        )
      : [];

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

  function handleTake(item: BriefItem, edit?: TakeEdit) {
    if (openTaskFor(item) || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    const doneBefore = tasks.find((t) => t.id === taskIds.get(item.id) && t.done);
    void run(async () => {
      if (doneBefore) {
        // Same item came back after being completed — reopen the existing task.
        const rev = await db.setTaskDone(doneBefore, false);
        setTasks((prev) => prev.map((t) => (t.id === doneBefore.id ? { ...t, done: false, rev } : t)));
      } else {
        const task = await db.insertTask(item, userId, current?.title, edit);
        setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
      }
      await log("taken", edit?.title.trim() || item.title, item.quadrant);
    }).finally(() => inFlight.current.delete(item.id));
  }

  /** The brief lists this as completed and a Planner task still covers it: tick that task. */
  function handleCompleteFromBrief(item: BriefItem) {
    const task = openTaskFor(item);
    if (task) handleToggleDone(task);
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
      const rev = await db.setTaskDone(task, !task.done);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done, rev } : t)));
      if (!task.done) await log("done", task.title, task.quadrant);
    });
  }

  async function handleSavePrompt(text: string) {
    setError(null);
    try {
      setPrompt(await db.savePrompt(text));
    } catch (err) {
      setError(`Couldn't save your prompt: ${message(err)}`);
      throw err; // keeps the editor open with the text
    }
  }

  function handleClearAll() {
    if (!window.confirm("Delete ALL pasted briefs, dismissed items and history? This can't be undone.")) return;
    const fromBrief = tasks;
    const alsoTasks =
      fromBrief.length > 0 &&
      window.confirm(
        `Also delete the ${fromBrief.length} task${fromBrief.length === 1 ? "" : "s"} Daily Brief created in your Planner?\n\nOK = delete them too · Cancel = keep them in your Planner`,
      );
    void run(async () => {
      await db.clearBriefData();
      if (alsoTasks) await db.deleteTasks(fromBrief);
      setBriefs([]);
      setDismissed(new Set());
      setHistory([]);
      setViewingId(null);
      if (alsoTasks) setTasks([]);
      setTab("today");
    });
  }

  function handleRemoveTask(task: MyTask) {
    if (!window.confirm(`Delete "${task.title}" from your Planner too?`)) return;
    void run(async () => {
      await db.deleteTask(task);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    });
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "clamp(12px, 4vw, 40px) clamp(12px, 4vw, 40px) 64px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", gap: 18 }}>
        <Header
          tab={tab}
          onTabChange={setTab}
          taskCount={tasks.filter((t) => !t.done).length}
          email={email}
          onSignOut={onSignOut}
          status={
            brief
              ? `Brief · ${brief.date?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? shortDate(current!.briefDate)}`
              : "No brief yet"
          }
        />

        <main style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && (
          <Card style={{ borderColor: "var(--badge-urgent-text)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14, color: "var(--do-text)" }}>
              <div style={{ flex: 1 }}>{error}</div>
              <button className="btn btn-icon" onClick={() => setError(null)} title="Dismiss" aria-label="Dismiss" style={{ width: 26, height: 26 }}>
                <XIcon size={12} />
              </button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="card" style={{ alignItems: "center", padding: 32 }}>
            <span className="shimmer-text" style={{ fontSize: 15, fontWeight: 600 }}>
              Loading your brief…
            </span>
          </div>
        ) : tab === "history" ? (
          <HistoryView
            entries={history}
            briefs={briefSummaries}
            openTasks={tasks.filter((t) => !t.done).length}
            onViewBrief={(id) => {
              setViewingId(id);
              setTab("today");
            }}
            onClearAll={handleClearAll}
          />
        ) : tab === "archive" ? (
          <ArchiveView
            archived={archived}
            keepDays={db.KEEP_DAYS.briefs}
            dismissed={dismissed}
            statusOf={statusOf}
            sinceOf={sinceOf}
            onTake={handleTake}
          />
        ) : tab === "tasks" ? (
          <MyTasksView tasks={tasks} onToggleDone={handleToggleDone} onRemove={handleRemoveTask} />
        ) : (
          <>
            {current && current.id !== briefs[0]?.id && (
              <Card>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 14, color: "var(--text-muted)" }}>
                  <div style={{ flex: 1 }}>
                    Viewing a past brief from <strong style={{ color: "var(--text)" }}>{shortDate(current.briefDate)}</strong>.
                  </div>
                  <button className="btn" onClick={() => setViewingId(null)}>
                    Back to latest
                  </button>
                </div>
              </Card>
            )}
            {storeMode === "local" && (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "0 6px" }}>
                Planner sync is on. Pasted briefs and history are kept in this browser until{" "}
                <code>supabase/schema.sql</code> is run in the Planner's Supabase project.
              </div>
            )}
            {promptOpen && prompt && <PromptPanel saved={prompt} onSave={handleSavePrompt} onClose={() => setPromptOpen(false)} />}
            <BriefImportCard
              brief={brief}
              prompt={prompt}
              onText={handleBriefText}
              onClear={handleClearBrief}
              onOpenPrompt={() => setPromptOpen((o) => !o)}
            />
            {brief && (
              <BriefView
                brief={brief}
                hidden={(id) => dismissed.has(id)}
                statusOf={statusOf}
                sinceOf={sinceOf}
                onTake={handleTake}
                onDismiss={handleDismiss}
                onComplete={handleCompleteFromBrief}
                carried={carried}
              />
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}
