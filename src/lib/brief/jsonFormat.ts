import { dueFromDate, dueFromText, hashId, itemId, rankItem, refsIn, sortItems, toPriority } from "./common";
import type { BriefItem, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Reader for the machine-readable block requested by AI_INSTRUCTIONS (see index.ts).
 * The AI has already merged duplicates and decided owner / urgency / risk, so this
 * mostly validates and ranks. Every field is treated as untrusted and coerced.
 */

/** Finds the first balanced {...} that parses as JSON and has an "items" (or "work_items") array. */
export function extractBriefJson(text: string): Record<string, unknown> | null {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === "\\") i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, i + 1));
          const v = value as { items?: unknown; work_items?: unknown } | null;
          if (v && typeof v === "object" && (Array.isArray(v.items) || Array.isArray(v.work_items))) return value;
        } catch {
          // not JSON — keep scanning
        }
        break;
      }
    }
  }
  return null;
}

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  return s && s.toLowerCase() !== "null" ? s : undefined;
};
const isoDay = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

function ownerOf(waitingOn: string | undefined, type: string | undefined): { owner: Owner; reason: string } {
  if (type === "fyi" || waitingOn === "none") return { owner: "fyi", reason: "FYI only" };
  if (waitingOn === "customer") return { owner: "others", reason: "Waiting on customer" };
  if (waitingOn === "third_party") return { owner: "others", reason: "Waiting on a third party" };
  if (waitingOn === "my_team") return { owner: "team", reason: "Owned by your team" };
  return { owner: "me", reason: "Reply or action expected from you" };
}

const KINDS: ItemKind[] = ["reply", "action", "decision", "follow_up", "fyi"];

/** "P1".."P4", "Critical", "High", "Medium", "Normal", "Low" → our levels. */
function priorityOf(v: unknown): Priority | undefined {
  const s = str(v)?.toLowerCase() ?? "";
  if (/^p1\b|critical|urgent/.test(s)) return "critical";
  if (/^p2\b|high/.test(s)) return "high";
  if (/^p3\b|medium/.test(s)) return "medium";
  if (/^p4\b|normal|low/.test(s)) return "low";
  return undefined;
}

/** Older / simpler schemas say "waiting on customer" in priority or category instead of waiting_on. */
function waitingOnOf(x: Record<string, unknown>): string | undefined {
  const explicit = str(x.waiting_on)?.toLowerCase();
  if (explicit) return explicit;
  const text = `${str(x.priority) ?? ""} ${str(x.category) ?? ""} ${str(x.status) ?? ""}`.toLowerCase();
  if (/waiting on (customer|vendor|user)|awaiting customer/.test(text)) return "customer";
  return undefined;
}

export function parseJsonBrief(data: Record<string, unknown>, fallbackDate?: Date): ParsedBrief {
  const day = isoDay(data.brief_date);
  const date = day ? new Date(day + "T00:00:00") : fallbackDate;
  const ref = date ?? new Date();

  // Supports this app's schema ("items") and the simpler "work_items" one.
  const rawItems = (Array.isArray(data.items) ? data.items : data.work_items) as unknown[];
  const items: BriefItem[] = rawItems
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const title = str(x.title) ?? str(x.subject) ?? "Untitled item";
      // "tickets" may come back as a list or as one string ("INC1, SR2")
      const tickets = (Array.isArray(x.tickets) ? x.tickets.map(String) : (str(x.tickets) ?? "").split(/[,;\s]+/)).filter(Boolean);
      const refs = [...new Set([...tickets, ...refsIn(`${title} ${str(x.subject) ?? ""}`)])];
      const type = str(x.type)?.toLowerCase();
      const kind: ItemKind = KINDS.includes(type as ItemKind) ? (type as ItemKind) : "action";
      const { owner, reason } = ownerOf(waitingOnOf(x), type);
      const priority = toPriority(x.urgency) ?? priorityOf(x.priority) ?? "medium";
      const risk = toPriority(x.risk); // a level; free text ("Risk if delayed") goes to the summary
      const riskText = risk ? undefined : str(x.risk);
      const dueRaw = x.due ?? x.due_date;
      const dueDay = isoDay(dueRaw);
      const due = dueDay ? dueFromDate(dueDay, ref) : dueFromText(str(dueRaw) ?? "");
      const rank = Number(x.top_rank);
      const topRank = x.top_rank != null && Number.isInteger(rank) && rank > 0 ? rank : undefined;
      const escalation = x.escalation === true || x.escalation === "true";
      const since = isoDay(x.waiting_since);
      const { score, quadrant } = rankItem({ priority, owner, kind, due, topRank, escalation });
      return {
        id: itemId(refs, str(x.subject) ?? title),
        subject: str(x.subject),
        kind,
        priority,
        title,
        from: str(x.from),
        customer: str(x.customer),
        summary:
          [str(x.subject) && str(x.subject) !== title ? str(x.subject) : undefined, str(x.why), riskText && `Risk if delayed: ${riskText}`]
            .filter(Boolean)
            .join(" — ") || undefined,
        status: str(x.status),
        action: str(x.next_action) ?? str(x.required_action),
        category: str(x.category),
        source: str(x.source),
        stage: str(x.stage),
        refs,
        owner,
        ownerReason: owner === "team" && str(x.owner) ? `Owned by ${str(x.owner)}` : reason,
        ownerName: owner === "me" || owner === "others" ? undefined : str(x.owner),
        suggestedReply: str(x.recommended_reply),
        canClose: x.can_close === true || undefined,
        topRank,
        due,
        dueDate: dueDay,
        waitingSince: since ? new Date(since + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) : undefined,
        risk,
        escalation: escalation || undefined,
        score,
        quadrant,
      };
    });

  const meetings = (Array.isArray(data.meetings) ? data.meetings : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && !!str(m.title))
    .map((m) => ({ id: hashId(`${str(m.when) ?? ""}${str(m.title)}`), when: str(m.when) ?? "", title: str(m.title)! }));

  // Counts come either as a "counts" object or as top-level "*_count" numbers.
  const countEntries = data.counts
    ? Object.entries(data.counts as Record<string, unknown>)
    : Object.entries(data).filter(([k]) => k.endsWith("_count")).map(([k, v]) => [k.replace(/_count$/, ""), v] as const);
  const counts = countEntries
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ label: k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).replace(/\buat\b/i, "UAT"), value: v as number }));

  return {
    format: "json",
    title: date ? `Daily Work Brief – ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "Daily Work Brief",
    date,
    items: sortItems(items),
    meetings,
    counts,
    executiveSummary: str(data.bottom_line) ?? str(data.summary),
  };
}
