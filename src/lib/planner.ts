import type { BriefItem, Priority } from "./brief";
import { isoDate } from "./dates";

/**
 * Bridge to the Planner app (Personal-Planning), which shares this Supabase project.
 * Tasks are written ONLY through the Planner's sync_push() RPC — the same path its own
 * devices use — so field edit times and revisions stay consistent and every Planner
 * device picks the change up (sync_push bumps sync_signals, which they listen to).
 */

export const PLANNER_URL = "https://yapseng98.github.io/Personal-Planning/";

/** The Planner logs in by username; Supabase Auth sees a never-shown shadow address. */
export function shadowEmail(username: string) {
  return `${username.trim().toLowerCase()}@planner-account.com`;
}

/** Planner priority: 1 critical … 5 optional. */
export function plannerPriority(p: Priority): number {
  return { critical: 1, high: 2, medium: 3, low: 4 }[p];
}

/** A concrete due date for the Planner from the brief's due label (or the item's own date). */
export function plannerDue(item: BriefItem, today = new Date()): string | undefined {
  if (item.dueDate) return item.dueDate;
  const d = new Date(today);
  if (item.due === "Today" || item.due === "Overdue") return isoDate(d);
  if (item.due === "Tomorrow") {
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }
  if (item.due === "This week") {
    d.setDate(d.getDate() + Math.max(0, 5 - d.getDay())); // this Friday (or today if later)
    return isoDate(d);
  }
  return item.quadrant === "do" ? isoDate(d) : undefined;
}

/** Task notes: everything useful from the brief, so the Planner task stands on its own. */
export function plannerNotes(item: BriefItem, briefTitle?: string): string {
  return [
    item.action && `Next: ${item.action}`,
    item.status && `Status: ${item.status}`,
    item.summary,
    item.refs.length ? `Tickets: ${item.refs.join(", ")}` : undefined,
    [item.from && `From: ${item.from}`, item.customer && `Customer: ${item.customer}`].filter(Boolean).join(" · ") || undefined,
    `— from Daily Brief${briefTitle ? ` (${briefTitle})` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface PushItem {
  table: "task";
  client_uuid: string;
  payload: Record<string, unknown>;
  edited_at: number;
  base_rev: number | null;
  fields: string[];
  field_times: Record<string, number>;
}

/** One push item that sets only `fields` (others are left as the server has them). */
export function taskPush(id: string, patch: Record<string, unknown>, baseRev: number | null): PushItem {
  const now = Date.now();
  const fields = Object.keys(patch);
  return {
    table: "task",
    client_uuid: id,
    payload: Object.fromEntries(fields.map((f) => [f, patch[f] ?? ""])),
    edited_at: now,
    base_rev: baseRev,
    fields,
    field_times: Object.fromEntries(fields.map((f) => [f, now])),
  };
}
