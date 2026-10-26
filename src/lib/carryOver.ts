import type { BriefItem } from "./brief";

export interface BriefSnapshot {
  briefDate: string; // ISO date
  title: string;
  items: BriefItem[];
}

export interface CarriedItem {
  item: BriefItem;
  fromDate: string; // the brief it was last seen in
  fromTitle: string;
}

/** Ticket numbers, the item id and a normalised title: anything that identifies "the same thing". */
function keysOf(item: BriefItem): string[] {
  const title = item.title.toLowerCase().replace(/^(re|fw|fwd):\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
  return [item.id, ...item.refs, `t:${title}`];
}

const daysBefore = (iso: string, days: number) =>
  new Date(new Date(iso + "T00:00:00").getTime() - days * 86_400_000).toISOString().slice(0, 10);

/**
 * Items whose most recent mention is in an earlier brief (not the latest one), from briefs
 * on or after `oldest`. `briefs` is newest first; briefs[0] is the latest. If a newer brief
 * mentions an item at all, that newer mention decides — so anything completed, reassigned
 * or still current is never returned. Completed and FYI items are left out.
 */
function olderItems(briefs: BriefSnapshot[], oldest: string): CarriedItem[] {
  if (briefs.length < 2) return [];
  const latest = briefs[0];
  const seen = new Set(latest.items.flatMap(keysOf));
  const out: CarriedItem[] = [];
  for (const brief of briefs.slice(1)) {
    for (const item of brief.items) {
      const keys = keysOf(item);
      if (keys.some((k) => seen.has(k))) continue; // a newer brief already decided this one
      keys.forEach((k) => seen.add(k));
      if (brief.briefDate < oldest || brief.briefDate >= latest.briefDate) continue; // too old, or a same-day re-paste
      if (!item.completed && item.owner !== "fyi") out.push({ item, fromDate: brief.briefDate, fromTitle: brief.title });
    }
  }
  return out;
}

/**
 * Items that were mine in an earlier brief (last `maxDays` before the latest brief) but
 * aren't mentioned in the latest one. Taken / dismissed items are filtered by the caller.
 */
export function carriedOver(briefs: BriefSnapshot[], maxDays = 14): CarriedItem[] {
  if (briefs.length < 2) return [];
  return olderItems(briefs, daysBefore(briefs[0].briefDate, maxDays))
    .filter((c) => c.item.owner === "me")
    .sort((a, b) => b.item.score - a.item.score);
}

/**
 * The Archive: every earlier item — mine, my team's or waiting on others — that today's
 * brief no longer mentions, from briefs within `keepDays` of today (older briefs are deleted
 * from the database). Newest brief first, most important first within a brief.
 */
export function archivedItems(briefs: BriefSnapshot[], keepDays = 30, today = new Date()): CarriedItem[] {
  const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
  return olderItems(briefs, daysBefore(todayIso, keepDays + 1)).sort(
    (a, b) => (a.fromDate < b.fromDate ? 1 : a.fromDate > b.fromDate ? -1 : b.item.score - a.item.score),
  );
}

/** Whole days until a brief from `fromDate` is deleted (it is kept `keepDays` days). */
export function daysLeft(fromDate: string, keepDays = 30, today = new Date()): number {
  const from = new Date(fromDate + "T00:00:00").getTime();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, keepDays - Math.round((start - from) / 86_400_000));
}
