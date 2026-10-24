import { supabase } from "./supabase";
import { isoDate, localTime } from "./dates";
import type { BriefItem } from "./brief";
import type { HistoryAction, HistoryEntry, MyTask, Quadrant } from "../types";

/** All reads and writes go through here. RLS scopes every query to the signed-in user. */

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

interface TaskRow {
  id: string;
  item_key: string;
  title: string;
  quadrant: Quadrant;
  due: string;
  from_name: string | null;
  action: string | null;
  refs: string[];
  score: number;
  done: boolean;
  created_at: string;
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

const toTask = (r: TaskRow): MyTask => ({
  id: r.id,
  itemKey: r.item_key,
  title: r.title,
  quadrant: r.quadrant,
  due: r.due,
  from: r.from_name ?? undefined,
  action: r.action ?? undefined,
  refs: r.refs,
  takenAt: isoDate(new Date(r.created_at)),
  done: r.done,
  score: r.score,
});

const toHistory = (r: HistoryRow): HistoryEntry => {
  const at = new Date(r.created_at);
  return { id: r.id, action: r.action, title: r.title, quadrant: r.quadrant ?? undefined, date: isoDate(at), time: localTime(at) };
};

// --- Briefs -----------------------------------------------------------------

/** Newest first. The latest one is what the Today tab shows. */
export async function fetchBriefs(limit = 60): Promise<StoredBrief[]> {
  const rows = check(
    await db().from("briefs").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as BriefRow[];
  return rows.map(toBrief);
}

export async function insertBrief(rawText: string, title: string, briefDate?: Date): Promise<StoredBrief> {
  const row = check(
    await db()
      .from("briefs")
      .insert({ raw_text: rawText, title, brief_date: briefDate ? isoDate(briefDate) : null })
      .select("*")
      .single(),
  ) as BriefRow;
  return toBrief(row);
}

export async function deleteBrief(id: string) {
  check(await db().from("briefs").delete().eq("id", id));
}

// --- My Tasks ---------------------------------------------------------------

export async function fetchTasks(): Promise<MyTask[]> {
  const rows = check(await db().from("tasks").select("*").order("created_at", { ascending: false })) as TaskRow[];
  return rows.map(toTask);
}

export async function insertTask(item: BriefItem, briefId: string | null): Promise<MyTask> {
  const row = check(
    await db()
      .from("tasks")
      .insert({
        item_key: item.id,
        brief_id: briefId,
        title: item.title,
        quadrant: item.quadrant,
        due: item.due,
        from_name: item.from ?? null,
        action: item.action ?? null,
        refs: item.refs,
        score: item.score,
      })
      .select("*")
      .single(),
  ) as TaskRow;
  return toTask(row);
}

export async function setTaskDone(id: string, done: boolean) {
  check(await db().from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id));
}

export async function deleteTask(id: string) {
  check(await db().from("tasks").delete().eq("id", id));
}

export async function deleteDoneTasks() {
  check(await db().from("tasks").delete().eq("done", true));
}

// --- Dismissed items --------------------------------------------------------

export async function fetchDismissed(): Promise<Set<string>> {
  const rows = check(await db().from("dismissed_items").select("item_key")) as { item_key: string }[];
  return new Set(rows.map((r) => r.item_key));
}

export async function insertDismissed(itemKey: string, title: string) {
  check(await db().from("dismissed_items").upsert({ item_key: itemKey, title }));
}

// --- History ----------------------------------------------------------------

export async function fetchHistory(limit = 300): Promise<HistoryEntry[]> {
  const rows = check(
    await db().from("history").select("*").order("created_at", { ascending: false }).limit(limit),
  ) as HistoryRow[];
  return rows.map(toHistory);
}

export async function insertHistory(action: HistoryAction, title: string, quadrant?: Quadrant): Promise<HistoryEntry> {
  const row = check(
    await db().from("history").insert({ action, title, quadrant: quadrant ?? null }).select("*").single(),
  ) as HistoryRow;
  return toHistory(row);
}

// --- Live updates -----------------------------------------------------------

export type Table = "briefs" | "tasks" | "dismissed_items" | "history";
const TABLES: Table[] = ["briefs", "tasks", "dismissed_items", "history"];

/**
 * Calls onChange(table) whenever a row in one of our tables changes — from this
 * tab, another tab or another device. Returns an unsubscribe function.
 */
export function subscribeToChanges(onChange: (table: Table) => void): () => void {
  const client = db();
  const channel = client.channel("daily-brief-changes");
  for (const table of TABLES) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(table));
  }
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
