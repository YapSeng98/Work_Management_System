import { parseDailyBrief } from "./dailyFormat";
import { looksLikeExecutiveBrief, parseExecutiveBrief } from "./execFormat";
import { extractBriefJson, parseJsonBrief } from "./jsonFormat";
import { looksLikeOwnershipBrief, parseOwnershipBrief } from "./ownershipFormat";
import { looksLikePriorityBrief, parsePriorityBrief } from "./priorityFormat";
import type { ParsedBrief } from "./types";
import { hashId, normTitle, parseLooseDate, rankItem, refsIn, sortItems } from "./common";
import { keywords } from "./execFormat";

export type { BriefItem, BriefMeeting, ItemKind, Owner, ParsedBrief, Priority } from "./types";
export { normTitle } from "./common";

/**
 * Analyse pasted brief text. Prefers the machine-readable JSON block when present
 * (most reliable), then the ownership report (Section A/B/C), then the older
 * executive report layout, then the original daily layout.
 * Runs entirely in the browser.
 */
export function parseBrief(text: string): ParsedBrief {
  return uniqueIds(parseAny(text));
}

/** Two items in one brief may share a ticket (e.g. "deploy the fix" and "send the RCA"). */
function uniqueIds(brief: ParsedBrief): ParsedBrief {
  const seen = new Set<string>();
  for (const item of brief.items) {
    if (seen.has(item.id)) item.id = hashId(`${item.id}|${normTitle(item.title)}`);
    seen.add(item.id);
  }
  return brief;
}

function parseAny(text: string): ParsedBrief {
  const json = extractBriefJson(text);
  if (json) {
    // The report text around the JSON still helps: its heading carries the date, and a
    // "Top N … Actions" list gives the ranking the JSON may leave out.
    const heading = text.split(/\r?\n/).find((l) => /brief/i.test(l) && parseLooseDate(l)) ?? "";
    const clean = normalize(text);
    const brief = parseJsonBrief(json, parseLooseDate(heading));
    // A sparse JSON (e.g. "work_items") leaves out details the report text has: fill them in.
    if (looksLikePriorityBrief(clean)) enrichFromReport(brief, parsePriorityBrief(clean));
    return addTopRanks(brief, clean);
  }
  const clean = normalize(text);
  if (looksLikeOwnershipBrief(clean)) return parseOwnershipBrief(clean);
  if (looksLikePriorityBrief(clean)) return parsePriorityBrief(clean);
  if (looksLikeExecutiveBrief(clean)) return parseExecutiveBrief(clean);
  return parseDailyBrief(clean);
}

/**
 * Strip the markdown AI tools add when a report is copied (## headings, > quotes,
 * "- " / "• " bullets, **bold**), so "- **Owner:** Jane" reads as "Owner: Jane".
 * Table rows ("| a | b |") are left alone — the table reader handles them.
 */
export function normalize(text: string): string {
  return text
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.trim();
      if (line.startsWith("|")) return line;
      return line
        .replace(/^#{1,6} +/, "") // a space, not a tab: "#\tTask" is a table header
        .replace(/^>\s*/, "")
        .replace(/^[-*•·▪◦]\s+/, "")
        .replace(/\*\*|__/g, "")
        .trim();
    })
    .join("\n");
}

/**
 * The JSON section the app reads best. Appended to the user's own AI prompt (the saved
 * prompt's "Add the app's data section" button, or "Copy AI instructions"). Generic —
 * no names or company details.
 */
export const AI_INSTRUCTIONS = `==================================================
MACHINE-READABLE JSON (for my Daily Brief app)
==================================================

Generate ONE AND ONLY ONE \`\`\`json code block. Every work item from the report must appear EXACTLY ONCE (merge mentions of the same ticket, incident, email conversation or meeting topic). Use exactly this structure:

{
  "brief_date": "YYYY-MM-DD",
  "bottom_line": "What is most urgent today, and what could become a customer escalation if delayed",
  "counts": { "critical": 0, "high": 0, "medium": 0, "normal": 0, "waiting_on_customer": 0, "waiting_on_team": 0 },
  "items": [
    {
      "title": "Short task title starting with a verb",
      "subject": "Original email subject, exactly as in Outlook",
      "tickets": ["INC0000000"],
      "category": "Production incident | RCA | Deployment | UAT | Commitment | Go-Live | Decisions Support | Support ticket | Meeting action | Other",
      "customer": "Customer / system",
      "owner": "Person who owns the next action",
      "waiting_on": "me | my_team | customer | third_party | none",
      "type": "reply | action | decision | follow_up | fyi",
      "status": "Latest status in one line",
      "why": "Why it needs my action",
      "next_action": "The next concrete step",
      "recommended_reply": "Suggested reply if a reply is expected from me, else null",
      "due": "YYYY-MM-DD or null",
      "urgency": "critical | high | medium | low",
      "risk": "Risk if delayed, in one line",
      "escalation": false,
      "top_rank": 1,
      "email_subject": "Latest email subject in the thread",
      "last_sender": "Name of the last sender",
      "last_received": "YYYY-MM-DDTHH:MM",
      "folder": "Source folder",
      "recipient_type": "to | cc",
      "email_age_hours": 0,
      "reply_required": true,
      "action_confidence": "confirmed | possible"
    }
  ],
  "meetings": [ { "when": "YYYY-MM-DD HH:MM", "title": "Meeting title" } ]
}

Rules: "urgency" maps P1 → critical, P2 → high, P3 → medium, P4 → low. "waiting_on" is "me" ONLY when an explicit action is required from me (being in CC, attending a meeting or being mentioned is not enough); "my_team" when a colleague owns the next action; "customer" when customer confirmation is pending; "third_party" when vendor action is pending; "none" for FYI. "action_confidence" is "possible" when ownership is unclear. "top_rank" is 1-5 only for the Top 5 items, else null. All dates in ISO format. Use null if unknown. Output valid JSON only inside the code block.`;

/**
 * Read a "Top 5 Recommended Actions" (or "Top N Priorities") numbered list from the
 * report text and give each matching item its rank — by ticket number, else by 2+
 * shared keywords with its title. Items that already have a rank keep it.
 */
function addTopRanks(brief: ParsedBrief, text: string): ParsedBrief {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^[^A-Za-z0-9]*top \d+\b.*(actions|priorities)/i.test(l) && !l.includes(":"));
  if (start < 0 || brief.items.some((i) => i.topRank)) return brief;
  let rank = 0;
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (!m) {
      if (rank && line.trim() && !/^[-•]/.test(line)) break; // next section
      continue;
    }
    rank = Number(m[1]);
    const refs = refsIn(m[2]);
    const words = keywords(m[2]);
    const match =
      brief.items.find((i) => !i.topRank && i.refs.some((r) => refs.includes(r))) ??
      brief.items
        .filter((i) => !i.topRank)
        .map((i) => ({ i, n: [...keywords(`${i.title} ${i.summary ?? ""}`)].filter((w) => words.has(w)).length }))
        .filter((x) => x.n >= 2)
        .sort((a, b) => b.n - a.n)[0]?.i;
    if (match) {
      match.topRank = rank;
      Object.assign(match, rankItem({ ...match, topRank: rank }));
    }
  }
  sortItems(brief.items);
  return brief;
}

const norm = (t: string) => t.toLowerCase().replace(/^(re|fw|fwd):\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The JSON stays the list of items; the report text only adds what an item is missing —
 * why it needs action, risk if delayed, customer, status, due date, escalation — plus the
 * meetings and counts when the JSON has none. Items are matched by ticket number, else by
 * the subject/title text, else by 3+ shared keywords.
 */
function enrichFromReport(brief: ParsedBrief, report: ParsedBrief) {
  const used = new Set<string>();
  for (const item of brief.items) {
    const words = keywords(`${item.title} ${item.summary ?? ""}`);
    const match =
      report.items.find((r) => !used.has(r.id) && r.refs.some((x) => item.refs.includes(x))) ??
      report.items.find((r) => !used.has(r.id) && (norm(r.title) === norm(item.title) || (r.summary ?? "").toLowerCase().includes(norm(item.title)))) ??
      report.items
        .filter((r) => !used.has(r.id))
        .map((r) => ({ r, n: [...keywords(`${r.title} ${r.summary ?? ""}`)].filter((w) => words.has(w)).length }))
        .filter((x) => x.n >= 3)
        .sort((a, b) => b.n - a.n)[0]?.r;
    if (!match) continue;
    used.add(match.id);
    const extra = (match.summary ?? "")
      .split(" — ")
      .filter((part) => part && !(item.summary ?? "").includes(part) && norm(part) !== norm(item.title));
    if (extra.length) item.summary = [item.summary, ...extra].filter(Boolean).join(" — ");
    item.customer ??= match.customer;
    item.status ??= match.status;
    item.action ??= match.action;
    if (!item.due && match.due) item.due = match.due;
    if (match.escalation && !item.escalation) item.escalation = true;
    for (const r of match.refs) if (!item.refs.includes(r)) item.refs.push(r);
    Object.assign(item, rankItem(item));
  }
  if (!brief.meetings.length) brief.meetings = report.meetings;
  if (!brief.counts.length) brief.counts = report.counts;
}
