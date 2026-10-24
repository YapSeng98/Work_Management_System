import { supabase } from "./supabase";
import { isoDate, localTime } from "./dates";
import { clearLocal, readLocal, writeLocal } from "./storage";
import { NOTES_MARKER, parseNotes, plannerDue, plannerNotes, plannerPriority, taskIdFor, taskPush, type PushItem } from "./planner";
import type { BriefItem } from "./brief";
import type { HistoryAction, HistoryEntry, MyTask, Quadrant } from "../types";

/**
 * All reads and writes go through here.
 *
 * - Tasks are real Planner tasks (public.tasks), written only via the Planner's
 *   sync_push RPC. Nothing extra is needed in the database for them.
 * - Briefs, dismissed items and history live in the brief_* tables when they exist
 *   (supabase/schema.sql); until then they're kept in this browser.
 */

function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type StoreMode = "supabase" | "local";
let mode: StoreMode = "supabase";

/** Use the brief_* tables if they exist, otherwise this browser. Call once after sign-in. */
export async function detectStore(): Promise<StoreMode> {
  const { error } = await db().from("brief_reports").select("id").limit(1);
  if (!error) mode = "supabase";
  else if (/could not find the table|does not exist|PGRST205/i.test(`${error.message} ${(error as { code?: string }).code ?? ""}`)) mode = "local";
  else throw new Error(error.message);
  return mode;
}

export interface StoredBrief {
  id: string;
  title: string;
  briefDate: string; // local ISO date the brief is for (falls back to when it was pasted)
  rawText: string;
  createdAt: string;
}

interface BriefRow {
  id: string;
  title: string;
  brief_date: string | null;
  raw_text: string;
  created_at: string;
}

interface PlannerTaskRow {
  id: string;
  title: string;
  notes: string | null;
  state: string;
  priority: number;
  due: string | null;
  rev: number | null;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  action: HistoryAction;
  title: string;
  quadrant: Quadrant | null;
  created_at: string;
}

const toBrief = (r: BriefRow): StoredBrief => ({
  id: r.id,
  title: r.title,
  briefDate: r.brief_date ?? isoDate(new Date(r.created_at)),
  rawText: r.raw_text,
  createdAt: r.created_at,
});

function dueLabel(iso: string | null): string {
  if (!iso) return "";
  const today = isoDate(new Date());
  if (iso < today) return "Overdue";
  if (iso === today) return "Today";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function toTask(t: PlannerTaskRow): MyTask {
  const meta = parseNotes(t.notes);
  const today = isoDate(new Date());
  const done = t.state === "done" || t.state === "cancelled";
  const due = dueLabel(t.due);
  return {
    id: t.id,
    title: t.title, // the Planner's current title — it may have been edited there
    quadrant: meta.quadrant ?? (t.due && t.due <= today ? "do" : t.priority <= 2 ? "schedule" : "later"),
    due,
    from: meta.from,
    action: meta.action,
    refs: meta.refs,
    done,
    closedOn: done ? isoDate(new Date(t.updated_at)) : undefined,
    score: (6 - t.priority) * 10 + (due === "Overdue" || due === "Today" ? 15 : 0),
    rev: t.rev,
  };
}

const toHistory = (r: HistoryRow): HistoryEntry => {
  const at = new Date(r.created_at);
  return { id: r.id, action: r.action, title: r.title, quadrant: r.quadrant ?? undefined, date: isoDate(at), time: localTime(at) };
};

async function syncPushAll(items: PushItem[]) {
  const data = check(await db().rpc("sync_push", { items })) as { results: { client_uuid: string; outcome: string }[] };
  const failed = items.filter((i) => data.results.find((r) => r.client_uuid === i.client_uuid)?.outcome !== "applied");
  if (failed.length) throw new Error(`Planner didn't accept ${failed.length} of ${items.length} changes`);
}

async function syncPush(items: PushItem[]) {
  const data = check(await db().rpc("sync_push", { items })) as {
    results: { client_uuid: string; outcome: string; rev?: number }[];
  };
  const result = data.results.find((r) => r.client_uuid === items[0].client_uuid);
  if (!result || result.outcome !== "applied") throw new Error(`Planner didn't accept the change (${result?.outcome ?? "no result"})`);
  return result;
}

// --- Briefs -----------------------------------------------------------------

/** Newest first. The latest one is what the Today tab shows. */
export async function fetchBriefs(limit = 60): Promise<StoredBrief[]> {
  if (mode === "local") return readLocal<StoredBrief[]>("briefs", []).slice(0, limit);
  const rows = check(
    await db().from("brief_reports").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as BriefRow[];
  return rows.map(toBrief);
}

/** How long stored data is kept; older rows are removed whenever a new brief is saved. */
const KEEP_DAYS = { briefs: 60, dismissed: 90, history: 180 };

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** Drop data past its keep period so the tables don't grow forever. */
async function pruneOld() {
  await Promise.all([
    db().from("brief_reports").delete().lt("created_at", daysAgo(KEEP_DAYS.briefs)),
    db().from("brief_dismissed").delete().lt("created_at", daysAgo(KEEP_DAYS.dismissed)),
    db().from("brief_history").delete().lt("created_at", daysAgo(KEEP_DAYS.history)),
  ]);
}

export async function insertBrief(rawText: string, title: string, briefDate?: Date): Promise<StoredBrief> {
  if (mode === "local") {
    const existing = readLocal<StoredBrief[]>("briefs", []);
    if (existing[0]?.rawText === rawText) return existing[0]; // same paste again — keep one copy
    const now = new Date();
    const brief: StoredBrief = {
      id: crypto.randomUUID(),
      title,
      briefDate: isoDate(briefDate ?? now),
      rawText,
      createdAt: now.toISOString(),
    };
    writeLocal("briefs", [brief, ...existing].slice(0, 60));
    return brief;
  }
  const latest = check(
    await db().from("brief_reports").select("*").order("created_at", { ascending: false }).limit(1),
  ) as BriefRow[];
  if (latest[0]?.raw_text === rawText) return toBrief(latest[0]); // same paste again — keep one copy
  const row = check(
    await db()
      .from("brief_reports")
      .insert({ raw_text: rawText, title, brief_date: briefDate ? isoDate(briefDate) : null })
      .select("*")
      .single(),
  ) as BriefRow;
  void pruneOld(); // housekeeping; a failure here doesn't affect the paste
  return toBrief(row);
}

export async function deleteBrief(id: string) {
  if (mode === "local") {
    writeLocal("briefs", readLocal<StoredBrief[]>("briefs", []).filter((b) => b.id !== id));
    return;
  }
  check(await db().from("brief_reports").delete().eq("id", id));
}

// --- My Tasks (Planner tasks taken from briefs) -------------------------------

/** Every Planner task that came from a brief (found by its notes footer), not deleted. */
export async function fetchTasks(): Promise<MyTask[]> {
  const rows = check(
    await db()
      .from("tasks")
      .select("id, title, notes, state, priority, due, rev, updated_at")
      .eq("deleted", false)
      .ilike("notes", `%${NOTES_MARKER}%`)
      .order("updated_at", { ascending: false })
      .limit(500),
  ) as PlannerTaskRow[];
  return rows.map(toTask);
}

/** Create the task in the Planner. Its id comes from the account + brief item. */
export async function insertTask(item: BriefItem, userId: string, briefTitle?: string): Promise<MyTask> {
  const id = await taskIdFor(userId, item.id);
  const due = plannerDue(item);
  const priority = plannerPriority(item.priority);
  const notes = plannerNotes(item, briefTitle);
  const result = await syncPush([
    taskPush(
      id,
      // deleted: false brings back a task that was taken before and then deleted
      { title: item.title, notes, state: "open", priority, ...(due ? { due } : {}), deleted: false },
      null,
    ),
  ]);
  return toTask({ id, title: item.title, notes, state: "open", priority, due: due ?? null, rev: result.rev ?? null, updated_at: new Date().toISOString() });
}

export async function setTaskDone(task: MyTask, done: boolean): Promise<number | null> {
  const result = await syncPush([taskPush(task.id, { state: done ? "done" : "open" }, task.rev)]);
  return result.rev ?? null;
}

/** Deletes the task in the Planner too (soft delete, like the Planner's own delete). */
export async function deleteTask(task: MyTask) {
  await syncPush([taskPush(task.id, { deleted: true }, task.rev)]);
}

/** Delete every listed task in the Planner (soft delete), in one request. */
export async function deleteTasks(tasks: MyTask[]) {
  if (tasks.length) await syncPushAll(tasks.map((t) => taskPush(t.id, { deleted: true }, t.rev)));
}

/** Remove all of this account's pasted briefs, dismissed items and history (Planner untouched). */
export async function clearBriefData() {
  clearLocal();
  if (mode === "local") return;
  const none = "00000000-0000-0000-0000-000000000000";
  // RLS limits each delete to the signed-in user's rows; the filters only satisfy
  // PostgREST's rule that a delete must have one.
  check(await db().from("brief_reports").delete().neq("id", none));
  check(await db().from("brief_dismissed").delete().neq("item_key", ""));
  check(await db().from("brief_history").delete().neq("id", none));
}

// --- Dismissed items --------------------------------------------------------

export async function fetchDismissed(): Promise<Set<string>> {
  if (mode === "local") return new Set(readLocal<string[]>("dismissed", []));
  const rows = check(await db().from("brief_dismissed").select("item_key")) as { item_key: string }[];
  return new Set(rows.map((r) => r.item_key));
}

export async function insertDismissed(itemKey: string, title: string) {
  if (mode === "local") {
    writeLocal("dismissed", [...new Set([...readLocal<string[]>("dismissed", []), itemKey])]);
    return;
  }
  check(await db().from("brief_dismissed").upsert({ item_key: itemKey, title }));
}

// --- History ----------------------------------------------------------------

export async function fetchHistory(limit = 300): Promise<HistoryEntry[]> {
  if (mode === "local") return readLocal<HistoryEntry[]>("history", []).slice(0, limit);
  const rows = check(
    await db().from("brief_history").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as HistoryRow[];
  return rows.map(toHistory);
}

export async function insertHistory(action: HistoryAction, title: string, quadrant?: Quadrant): Promise<HistoryEntry> {
  if (mode === "local") {
    const at = new Date();
    const entry: HistoryEntry = { id: crypto.randomUUID(), action, title, quadrant, date: isoDate(at), time: localTime(at) };
    writeLocal("history", [entry, ...readLocal<HistoryEntry[]>("history", [])].slice(0, 300));
    return entry;
  }
  const row = check(
    await db().from("brief_history").insert({ action, title, quadrant: quadrant ?? null }).select("*").single(),
  ) as HistoryRow;
  return toHistory(row);
}

// --- Live updates -----------------------------------------------------------

export type Table = "briefs" | "tasks" | "dismissed_items" | "history";

/**
 * Calls onChange(kind) whenever stored data changes — from another tab, another
 * device, or the Planner app itself. Returns an unsubscribe function.
 */
export function subscribeToChanges(onChange: (table: Table) => void): () => void {
  const client = db();
  const channel = client.channel("daily-brief-changes");
  // The Planner bumps sync_signals on every task change, from any device.
  channel.on("postgres_changes", { event: "*", schema: "public", table: "sync_signals" }, () => onChange("tasks"));
  if (mode === "supabase") {
    const tables: [string, Table][] = [
      ["brief_reports", "briefs"],
      ["brief_dismissed", "dismissed_items"],
      ["brief_history", "history"],
    ];
    for (const [table, kind] of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(kind));
    }
  }
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
