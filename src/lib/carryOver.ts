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

/**
 * Items that were mine in an earlier brief but aren't mentioned in the latest one.
 * `briefs` is newest first; briefs[0] is the latest. For each item, only its most recent
 * mention counts: if a newer brief completed it, gave it to someone else, or mentions it
 * at all, it isn't carried. Taken / dismissed items are filtered by the caller.
 */
export function carriedOver(briefs: BriefSnapshot[], maxDays = 14): CarriedItem[] {
  if (briefs.length < 2) return [];
  const latest = briefs[0];
  const seen = new Set(latest.items.flatMap(keysOf));
  const oldest = new Date(new Date(latest.briefDate + "T00:00:00").getTime() - maxDays * 86_400_000).toISOString().slice(0, 10);
  const out: CarriedItem[] = [];
  for (const brief of briefs.slice(1)) {
    for (const item of brief.items) {
      const keys = keysOf(item);
      if (keys.some((k) => seen.has(k))) continue; // a newer brief already decided this one
      keys.forEach((k) => seen.add(k));
      if (brief.briefDate < oldest || brief.briefDate >= latest.briefDate) continue;
      if (item.owner === "me" && !item.completed) out.push({ item, fromDate: brief.briefDate, fromTitle: brief.title });
    }
  }
  return out.sort((a, b) => b.item.score - a.item.score);
}
