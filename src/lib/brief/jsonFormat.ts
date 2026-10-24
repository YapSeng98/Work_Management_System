import { dueFromDate, dueFromText, hashId, rankItem, refsIn, sortItems, toPriority } from "./common";
import type { BriefItem, ItemKind, Owner, ParsedBrief } from "./types";

/**
 * Reader for the machine-readable block requested by AI_INSTRUCTIONS (see index.ts).
 * The AI has already merged duplicates and decided owner / urgency / risk, so this
 * mostly validates and ranks. Every field is treated as untrusted and coerced.
 */

/** Finds the first balanced {...} that parses as JSON and has an "items" array. */
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
          if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) return value;
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

export function parseJsonBrief(data: Record<string, unknown>): ParsedBrief {
  const day = isoDay(data.brief_date);
  const date = day ? new Date(day + "T00:00:00") : undefined;
  const ref = date ?? new Date();

  const items: BriefItem[] = (data.items as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const title = str(x.title) ?? str(x.subject) ?? "Untitled item";
      // "tickets" may come back as a list or as one string ("INC1, SR2")
      const tickets = (Array.isArray(x.tickets) ? x.tickets.map(String) : (str(x.tickets) ?? "").split(/[,;\s]+/)).filter(Boolean);
      const refs = [...new Set([...tickets, ...refsIn(`${title} ${str(x.subject) ?? ""}`)])];
      const type = str(x.type)?.toLowerCase();
      const kind: ItemKind = KINDS.includes(type as ItemKind) ? (type as ItemKind) : "action";
      const { owner, reason } = ownerOf(str(x.waiting_on)?.toLowerCase(), type);
      const priority = toPriority(x.urgency) ?? "medium";
      const risk = toPriority(x.risk);
      const dueDay = isoDay(x.due);
      const due = dueDay ? dueFromDate(dueDay, ref) : dueFromText(str(x.due) ?? "");
      const rank = Number(x.top_rank);
      const topRank = x.top_rank != null && Number.isInteger(rank) && rank > 0 ? rank : undefined;
      const escalation = x.escalation === true || x.escalation === "true";
      const since = isoDay(x.waiting_since);
      const { score, quadrant } = rankItem({ priority, owner, kind, due, topRank, escalation });
      return {
        id: hashId("x:" + (refs[0] ?? (str(x.subject) ?? title).toLowerCase().replace(/^(re|fw|fwd):\s*/i, ""))),
        kind,
        priority,
        title,
        from: str(x.from),
        customer: str(x.customer),
        summary: str(x.subject) && str(x.subject) !== title ? str(x.subject) : undefined,
        status: str(x.status),
        action: str(x.next_action),
        stage: str(x.stage),
        refs,
        owner,
        ownerReason: owner === "team" && str(x.owner) ? `Owned by ${str(x.owner)}` : reason,
        ownerName: owner === "me" ? undefined : str(x.owner),
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

  const counts = Object.entries((data.counts as Record<string, unknown>) ?? {})
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ label: k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).replace(/\buat\b/i, "UAT"), value: v as number }));

  return {
    format: "json",
    title: date ? `Executive Work Brief – ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "Executive Work Brief",
    date,
    items: sortItems(items),
    meetings,
    counts,
    executiveSummary: str(data.bottom_line),
  };
}
