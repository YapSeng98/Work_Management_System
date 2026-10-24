import { supabase } from "./supabase";
import { isoDate, localTime } from "./dates";
import { plannerDue, plannerNotes, plannerPriority, taskPush, type PushItem } from "./planner";
import type { BriefItem } from "./brief";
import type { HistoryAction, HistoryEntry, MyTask, Quadrant } from "../types";

/**
 * All reads and writes go through here. Brief data lives in the brief_* tables;
 * taken tasks are real Planner tasks (public.tasks), written via sync_push only.
 * RLS scopes every query to the signed-in user.
 */

function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
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

interface LinkRow {
  item_key: string;
  task_id: string;
  quadrant: Quadrant;
  from_name: string | null;
  action: string | null;
  refs: string[];
  score: number;
  created_at: string;
}

interface PlannerTaskRow {
  id: string;
  title: string;
  state: string;
  due: string | null;
  deleted: boolean;
  rev: number | null;
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

const toTask = (link: LinkRow, t: PlannerTaskRow): MyTask => ({
  id: t.id,
  itemKey: link.item_key,
  title: t.title, // the Planner's current title — it may have been edited there
  quadrant: link.quadrant,
  due: dueLabel(t.due),
  from: link.from_name ?? undefined,
  action: link.action ?? undefined,
  refs: link.refs,
  takenAt: isoDate(new Date(link.created_at)),
  done: t.state === "done" || t.state === "cancelled",
  score: link.score,
  rev: t.rev,
});

const toHistory = (r: HistoryRow): HistoryEntry => {
  const at = new Date(r.created_at);
  return { id: r.id, action: r.action, title: r.title, quadrant: r.quadrant ?? undefined, date: isoDate(at), time: localTime(at) };
};

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
  const rows = check(
    await db().from("brief_reports").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as BriefRow[];
  return rows.map(toBrief);
}

export async function insertBrief(rawText: string, title: string, briefDate?: Date): Promise<StoredBrief> {
  const row = check(
    await db()
      .from("brief_reports")
      .insert({ raw_text: rawText, title, brief_date: briefDate ? isoDate(briefDate) : null })
      .select("*")
      .single(),
  ) as BriefRow;
  return toBrief(row);
}

export async function deleteBrief(id: string) {
  check(await db().from("brief_reports").delete().eq("id", id));
}

// --- My Tasks (Planner tasks taken from briefs) -------------------------------

/** Linked Planner tasks, newest first. Tasks deleted in the Planner drop out. */
export async function fetchTasks(): Promise<MyTask[]> {
  const links = check(
    await db().from("brief_task_links").select("*").order("created_at", { ascending: false }),
  ) as LinkRow[];
  if (!links.length) return [];
  const rows = check(
    await db().from("tasks").select("id, title, state, due, deleted, rev").in("id", links.map((l) => l.task_id)),
  ) as PlannerTaskRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return links.flatMap((l) => {
    const t = byId.get(l.task_id);
    return t && !t.deleted ? [toTask(l, t)] : [];
  });
}

/** Create the task in the Planner, then remember which brief item it came from. */
export async function insertTask(item: BriefItem, brief: { id: string; title: string } | null): Promise<MyTask> {
  const id = crypto.randomUUID();
  const due = plannerDue(item);
  const result = await syncPush([
    taskPush(
      id,
      {
        title: item.title,
        notes: plannerNotes(item, brief?.title),
        state: "open",
        priority: plannerPriority(item.priority),
        ...(due ? { due } : {}),
      },
      null,
    ),
  ]);
  const link = check(
    await db()
      .from("brief_task_links")
      .insert({
        item_key: item.id,
        task_id: id,
        brief_id: brief?.id ?? null,
        quadrant: item.quadrant,
        from_name: item.from ?? null,
        action: item.action ?? null,
        refs: item.refs,
        score: item.score,
      })
      .select("*")
      .single(),
  ) as LinkRow;
  return toTask(link, { id, title: item.title, state: "open", due: due ?? null, deleted: false, rev: result.rev ?? null });
}

export async function setTaskDone(task: MyTask, done: boolean): Promise<number | null> {
  const result = await syncPush([taskPush(task.id, { state: done ? "done" : "open" }, task.rev)]);
  return result.rev ?? null;
}

/** Deletes the task in the Planner too (soft delete, like the Planner's own delete). */
export async function deleteTask(task: MyTask) {
  await syncPush([taskPush(task.id, { deleted: true }, task.rev)]);
  check(await db().from("brief_task_links").delete().eq("task_id", task.id));
}

/** Hide finished tasks from My Tasks; they stay in the Planner as done. */
export async function unlinkTasks(taskIds: string[]) {
  if (taskIds.length) check(await db().from("brief_task_links").delete().in("task_id", taskIds));
}

// --- Dismissed items --------------------------------------------------------

export async function fetchDismissed(): Promise<Set<string>> {
  const rows = check(await db().from("brief_dismissed").select("item_key")) as { item_key: string }[];
  return new Set(rows.map((r) => r.item_key));
}

export async function insertDismissed(itemKey: string, title: string) {
  check(await db().from("brief_dismissed").upsert({ item_key: itemKey, title }));
}

// --- History ----------------------------------------------------------------

export async function fetchHistory(limit = 300): Promise<HistoryEntry[]> {
  const rows = check(
    await db().from("brief_history").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as HistoryRow[];
  return rows.map(toHistory);
}

export async function insertHistory(action: HistoryAction, title: string, quadrant?: Quadrant): Promise<HistoryEntry> {
  const row = check(
    await db().from("brief_history").insert({ action, title, quadrant: quadrant ?? null }).select("*").single(),
  ) as HistoryRow;
  return toHistory(row);
}

// --- Live updates -----------------------------------------------------------

export type Table = "briefs" | "tasks" | "dismissed_items" | "history";

const SOURCES: { table: string; refresh: Table }[] = [
  { table: "brief_reports", refresh: "briefs" },
  { table: "brief_task_links", refresh: "tasks" },
  { table: "sync_signals", refresh: "tasks" }, // bumped by the Planner on every task change, from any device
  { table: "brief_dismissed", refresh: "dismissed_items" },
  { table: "brief_history", refresh: "history" },
];

/**
 * Calls onChange(kind) whenever stored data changes — from this tab, another tab,
 * another device, or the Planner app itself. Returns an unsubscribe function.
 */
export function subscribeToChanges(onChange: (table: Table) => void): () => void {
  const client = db();
  const channel = client.channel("daily-brief-changes");
  for (const s of SOURCES) {
    channel.on("postgres_changes", { event: "*", schema: "public", table: s.table }, () => onChange(s.refresh));
  }
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
