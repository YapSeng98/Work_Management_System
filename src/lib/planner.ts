import type { BriefItem, Priority } from "./brief";
import { isoDate } from "./dates";
import { quadrantLabel, quadrantOrder } from "../quadrant";
import type { Quadrant } from "../types";

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

/**
 * Same id on every device for this account + brief item, the way the Planner derives
 * ids itself (its db.ts uuidFrom). Taking an item twice targets the same task, and
 * "already taken?" needs no link table.
 */
export async function taskIdFor(userId: string, itemKey: string): Promise<string> {
  const data = new TextEncoder().encode(`daily-brief:${userId}:${itemKey}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50; // version 5-style (name-based)
  h[8] = (h[8] & 0x3f) | 0x80; // RFC 4122 variant
  const x = [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** Last line of every task's notes — how My Tasks finds tasks that came from a brief. */
export const NOTES_MARKER = "— Daily Brief ·";

/** The editable part of a task's notes: everything useful from the brief. */
export function plannerNotesBody(item: BriefItem): string {
  return [
    item.action && `Next: ${item.action}`,
    item.status && `Status: ${item.status}`,
    item.summary,
    item.refs.length ? `Tickets: ${item.refs.join(", ")}` : undefined,
    item.suggestedReply && `Suggested reply: ${item.suggestedReply}`,
    item.ownerName && `Owner: ${item.ownerName}`,
    [item.from && `From: ${item.from}`, item.customer && `Customer: ${item.customer}`].filter(Boolean).join(" · ") || undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The fixed last line — how My Tasks (and the Planner's "Brief" badge) find these tasks. */
export function notesFooter(item: BriefItem, briefTitle?: string): string {
  return `${NOTES_MARKER} ${quadrantLabel[item.quadrant]}${briefTitle ? ` · ${briefTitle}` : ""}`;
}

/** Full task notes: the (possibly edited) body, then the footer — always re-added. */
export function plannerNotes(item: BriefItem, briefTitle?: string, body = plannerNotesBody(item)): string {
  const clean = body
    .split("\n")
    .filter((l) => !l.startsWith(NOTES_MARKER))
    .join("\n")
    .trim();
  return [clean, notesFooter(item, briefTitle)].filter(Boolean).join("\n");
}

/** What the user changed in "Edit & take" before the task is created. */
export interface TakeEdit {
  title: string;
  body: string;
  due: string; // ISO date, or "" for none
  priority: Priority;
}

/** Reads back what plannerNotes wrote (tolerant of edits made in the Planner). */
export function parseNotes(notes: string | null) {
  const lines = (notes ?? "").split("\n");
  const field = (name: string) => lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2);
  const footer = lines.find((l) => l.startsWith(NOTES_MARKER)) ?? "";
  const quadrant = quadrantOrder.find((q) => footer.includes(`· ${quadrantLabel[q]}`)) as Quadrant | undefined;
  return {
    action: field("Next"),
    refs: (field("Tickets") ?? "").split(",").map((r) => r.trim()).filter(Boolean),
    from: field("From")?.split(" · ")[0],
    quadrant,
  };
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
