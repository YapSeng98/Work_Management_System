import type { Quadrant } from "../../types";
import { hashId, refsIn, sortItems } from "./common";
import type { BriefItem, BriefMeeting, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Reader for the original "Daily Work Brief" layout:
 *   🔴 Needs Reply / 🟠 Action Required / 🟡 Decision Required — items start with "[High] …"
 *   🔵 Meeting & Schedule — "Today 2:00 PM" followed by a title line
 *   ⚪ FYI — title line followed by a summary line
 *   Today's Top 5 Priorities, Support Summary ("Waiting for Customer", "Waiting for <your team>", …)
 */

type Section =
  | "reply"
  | "action"
  | "decision"
  | "fyi"
  | "meetings"
  | "top"
  | "waitCustomer"
  | "waitUs"
  | "investigating"
  | "closed"
  | "ignore";

const CHASE_RE =
  /\b(chase|follow up on|track (?:uat|approval)|awaiting (?:user|customer|business|final|stakeholder)|waiting for (?:user|customer|business|verification|sign-?off)|once .{0,40}(?:received|confirmed|verified))/i;

const TODAY_RE = /\b(eod|today|asap|urgent|immediately)\b/i;
const WEEK_RE = /\b(end of (?:this )?week|this week|by (?:mon|tue|wed|thu|fri)[a-z]*)\b/i;

function sectionOf(line: string): Section | null {
  const t = line.replace(/^[^A-Za-z0-9]+/, "").trim().toLowerCase();
  if (!t || t.length > 60) return null;
  if (/^needs reply/.test(t)) return "reply";
  if (/^action required/.test(t)) return "action";
  if (/^decision required/.test(t)) return "decision";
  if (/^meetings?\b/.test(t)) return "meetings";
  if (/^fyi\b/.test(t)) return "fyi";
  if (/^today'?s top \d* ?priorities/.test(t)) return "top";
  if (/^waiting for (customer|client|user|business)/.test(t)) return "waitCustomer";
  if (/^waiting for /.test(t)) return "waitUs";
  if (/^under investigation/.test(t)) return "investigating";
  if (/^closed\b/.test(t)) return "closed";
  if (
    /^(outstanding customer|open support|pending (uat|deployment)|active defects|governance|suggested work plan|.*support summary$)/.test(t)
  )
    return "ignore";
  return null;
}

function parseDate(title: string): Date | undefined {
  const m = title.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (!m) return undefined;
  const d = new Date(`${m[1]} ${m[2]} ${m[3]}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface RawItem {
  kind: ItemKind;
  priority: Priority;
  header: string;
  lines: string[];
}

export function parseDailyBrief(text: string): ParsedBrief {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const title = lines.find((l) => l.length > 0) ?? "Daily Brief";
  const date = parseDate(title);

  const raws: RawItem[] = [];
  const meetings: BriefMeeting[] = [];
  const topRank = new Map<string, number>();
  const lists: Record<"waitCustomer" | "waitUs" | "investigating" | "closed", Set<string>> = {
    waitCustomer: new Set(),
    waitUs: new Set(),
    investigating: new Set(),
    closed: new Set(),
  };
  let executiveSummary: string | undefined;

  let section: Section | null = null;
  let current: RawItem | null = null;
  let pending: string | null = null; // first half of a two-line meeting / FYI entry
  let rank = 0;

  for (const line of lines) {
    if (!line) continue;

    const exec = line.match(/^executive summary:\s*(.*)$/i);
    if (exec) {
      executiveSummary = exec[1];
      section = "ignore";
      continue;
    }

    const next = sectionOf(line);
    if (next) {
      section = next;
      current = null;
      pending = null;
      continue;
    }

    switch (section) {
      case "reply":
      case "action":
      case "decision": {
        const tagged = line.match(/^\[(critical|high|medium|low)\]\s*(.+)$/i);
        if (tagged) {
          current = { kind: section, priority: tagged[1].toLowerCase() as Priority, header: tagged[2], lines: [] };
          raws.push(current);
        } else if (current) {
          current.lines.push(line);
        }
        break;
      }
      case "fyi":
        if (pending === null) pending = line;
        else {
          raws.push({ kind: "fyi", priority: "low", header: pending, lines: [line] });
          pending = null;
        }
        break;
      case "meetings":
        if (pending === null) pending = line;
        else {
          // Usually "when" comes first; tolerate the reverse order.
          const firstIsTime = /\d{1,2}:\d{2}/.test(pending) && pending.length < 40;
          const [when, mtitle] = firstIsTime ? [pending, line] : [line, pending];
          meetings.push({ id: hashId(when + mtitle), when, title: mtitle });
          pending = null;
        }
        break;
      case "top": {
        const refs = refsIn(line);
        if (refs.length) {
          rank++;
          for (const r of refs) if (!topRank.has(r)) topRank.set(r, rank);
        }
        break;
      }
      case "waitCustomer":
      case "waitUs":
      case "investigating":
      case "closed":
        for (const r of refsIn(line)) lists[section].add(r);
        break;
    }
  }

  const weekEndsToday = date !== undefined && date.getDay() >= 5; // brief written on Fri/Sat
  const items = raws.map((raw) => toItem(raw, { topRank, lists, weekEndsToday }));

  return { format: "daily", title, date, items: sortItems(items), meetings, counts: [], executiveSummary };
}

function toItem(
  raw: RawItem,
  ctx: {
    topRank: Map<string, number>;
    lists: Record<"waitCustomer" | "waitUs" | "investigating" | "closed", Set<string>>;
    weekEndsToday: boolean;
  },
): BriefItem {
  let action: string | undefined;
  let timeline: string | undefined;
  const summaryLines: string[] = [];
  for (const l of raw.lines) {
    const field = l.match(/^(action|decision|timeline|deadline|due):\s*(.*)$/i);
    if (!field) summaryLines.push(l);
    else if (/^(timeline|deadline|due)$/i.test(field[1])) timeline = field[2];
    else action = field[2];
  }
  const summary = summaryLines.join(" ") || undefined;

  // "Jane Tan — RE: …" → sender + subject. Only split on a dash with spaces around it.
  let from: string | undefined;
  let title = raw.header;
  const sender = raw.header.match(/^([^\d—–:[\]]{2,40}?)\s+[—–]\s+(.+)$/);
  if (sender && !/^re\b/i.test(sender[1])) {
    from = sender[1].trim();
    title = sender[2].trim();
  }

  const refs = refsIn(raw.header + " " + raw.lines.join(" "));
  const inList = (name: keyof typeof ctx.lists) => refs.find((r) => ctx.lists[name].has(r));
  const ranks = refs.map((r) => ctx.topRank.get(r)).filter((n): n is number => n !== undefined);
  const topRank = ranks.length ? Math.min(...ranks) : undefined;

  let owner: Owner;
  let ownerReason: string;
  let ref: string | undefined;
  if (raw.kind === "fyi") {
    owner = "fyi";
    ownerReason = "FYI only";
  } else if ((ref = inList("closed"))) {
    owner = "fyi";
    ownerReason = `Closed (${ref})`;
  } else if ((ref = inList("waitUs") ?? inList("investigating"))) {
    owner = "me";
    ownerReason = `Waiting on your team (${ref})`;
  } else if ((ref = inList("waitCustomer"))) {
    owner = "others";
    ownerReason = `Waiting on customer (${ref})`;
  } else if (CHASE_RE.test(`${action ?? ""} ${summary ?? ""}`)) {
    owner = "others";
    ownerReason = "You're waiting on someone else";
  } else {
    owner = "me";
    ownerReason = raw.kind === "reply" ? "Someone is waiting for your reply" : raw.kind === "decision" ? "Needs your decision" : "Action is on you";
  }

  const timeText = `${timeline ?? ""} ${summary ?? ""}`;
  const due = TODAY_RE.test(timeText) || (ctx.weekEndsToday && WEEK_RE.test(timeText))
    ? "Today"
    : WEEK_RE.test(timeText)
      ? "This week"
      : "";

  const score =
    { critical: 40, high: 30, medium: 20, low: 10 }[raw.priority] +
    (topRank ? (6 - Math.min(topRank, 5)) * 5 : 0) +
    (due === "Today" ? 15 : due === "This week" ? 8 : 0) +
    (raw.kind === "reply" ? 5 : raw.kind === "decision" ? 3 : 0);

  let quadrant: Quadrant;
  if (owner === "fyi") quadrant = "later";
  else if (owner === "others") quadrant = "delegate";
  else if (due === "Today" || (topRank !== undefined && topRank <= 3)) quadrant = "do";
  else if (raw.priority === "high" || raw.priority === "critical" || due === "This week" || topRank !== undefined) quadrant = "schedule";
  else quadrant = "later";

  return {
    id: hashId(raw.kind + raw.header),
    kind: raw.kind,
    priority: raw.priority,
    title,
    from,
    summary,
    action,
    timeline,
    refs,
    owner,
    ownerReason,
    topRank,
    due,
    score,
    quadrant,
  };
}
