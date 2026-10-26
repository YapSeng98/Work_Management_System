import { dueFromText, itemId, maxPriority, parseLooseDate, priorityRank, rankItem, refsIn, sortItems, toPriority } from "./common";
import { Merger, TableReader, type Acc, type Mention } from "./execFormat";
import type { BriefCount, BriefItem, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Reader for the ownership-first "EXECUTIVE WORK BRIEF": SECTION A (my actions only),
 * SECTION B (actions owned by colleagues — NOT mine), SECTION C (waiting on customer),
 * ESCALATIONS, AGING ITEMS, a TOP 10 table and an EXECUTIVE SUMMARY count table.
 * Entries are a title line followed by "Field: value" lines.
 *
 * The brief's own split decides ownership: A → me, B → team, C → others. Escalations,
 * aging items and the Top 10 are merged into those items (by ticket, else keywords);
 * the Top 10 / escalation "Owner" columns also count. Anything no section claims is
 * left with the team — the prompt says only Section A is mine.
 */

export function looksLikeOwnershipBrief(text: string) {
  return /\bmy actions\b/i.test(text) && /(section b\b|team actions|waiting on customer)/i.test(text);
}

type Section =
  | "summary"
  | "changes"
  | "mine"
  | "team"
  | "customer"
  | "notes"
  | "engagements"
  | "completed"
  | "escalations"
  | "aging"
  | "top"
  | "ignore";

function sectionOf(line: string): Section | null {
  const t = line.replace(/^[^A-Za-z0-9]+/, "").trim().toLowerCase();
  if (!t || t.length > 70) return null;
  if (line !== line.toUpperCase()) {
    // A Title-case heading: no colon or full stop, and the section name starts the line
    // (so a sentence such as "Waiting on customer feedback." is never taken for one).
    if (/[:\t|]/.test(line) || line.endsWith(".")) return null; // fields, table rows, sentences
    if (/^executive summary\b/.test(t)) return "summary";
    if (/^what changed\b/.test(t)) return "changes";
    if (/^completed\b|no longer my action/.test(t)) return "completed";
    if (/^(important )?new emails\b/.test(t)) return "notes";
    if (/^decision support\b|engagements?$/.test(t)) return "engagements";
    if (/^(section a\b|my actions\b)/.test(t)) return "mine";
    if (/^(section b\b|(\w+ )?team actions\b)/.test(t)) return "team";
    if (/^(section c\b|waiting on customer\b)/.test(t)) return "customer";
    if (/^escalations\b/.test(t)) return "escalations";
    if (/^(aging items|risks)\b/.test(t)) return "aging";
    if (/^(([\w/]+ ){0,3}priorities\b|top \d+ priorities)/.test(t)) return "top";
    if (/^(executive )?recommendation|^executive work brief/.test(t)) return "ignore";
    return null;
  }
  if (/^executive summary/.test(t)) return "summary";
  if (/what changed/.test(t)) return "changes";
  if (/^completed\b|no longer my action/.test(t)) return "completed";
  if (/new emails|emails to note/.test(t)) return "notes";
  if (/decision support|engagements?\b/.test(t)) return "engagements";
  if (/section a\b|my actions/.test(t)) return "mine";
  if (/section b\b|team actions/.test(t)) return "team";
  if (/section c\b|waiting on customer/.test(t)) return "customer";
  if (/^escalations/.test(t)) return "escalations";
  if (/aging items|^risks/.test(t)) return "aging";
  if (/priorities/.test(t)) return "top";
  if (/recommendation|executive work brief/.test(t)) return "ignore";
  return null;
}

/** The user's name, as the brief itself writes it ("Required Action From Jane Tan:"). */
function findMyName(text: string): string | undefined {
  return (
    text.match(/Required Action From ([A-Z][^:\n]{2,40}?)\s*:/)?.[1] ??
    text.match(/What ([A-Z][^\n]{2,40}?) should do first/)?.[1]
  )?.trim();
}

function nameWords(s: string): string[] {
  return s.toLowerCase().match(/[a-z]+/g) ?? [];
}

const FIELD_RE = /^([A-Za-z][A-Za-z ?/'()&-]{1,48}?)\s*:\s*(.*)$/;

function levelOf(line: string): Priority | undefined {
  return line.split(/\s+/).length === 1 ? toPriority(line) : undefined;
}

/** "HIGH", "MEDIUM-HIGH", "High because …" → the highest level named at the start. */
function levelIn(value: string): Priority | undefined {
  const words = value.split(/[\s,.;/-]+/).slice(0, 3);
  return words.map((w) => toPriority(w)).reduce<Priority | undefined>((a, b) => maxPriority(a, b), undefined);
}

const IGNORE_VALUE = /^(not stated|n\/a|none|tbd|unknown|-)\.?$/i;

export function parseOwnershipBrief(text: string): ParsedBrief {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const title = lines.find((l) => l.length > 0 && !/^=+$/.test(l)) ?? "Executive Work Brief";
  const myName = findMyName(text);
  const myWords = myName ? nameWords(myName) : [];
  const isMe = (who: string) => {
    if (!myWords.length) return false;
    const hits = nameWords(who).filter((w) => myWords.includes(w)).length;
    return hits >= Math.min(2, myWords.length);
  };

  const merger = new Merger();
  const table = new TableReader();
  const counts: BriefCount[] = [];
  let executiveSummary: string | undefined;
  const changes: string[] = [];
  let section: Section | null = null;
  let level: Priority | undefined;
  let entry: (Mention & { fields: number }) | null = null;

  const flush = () => {
    if (entry) merger.add(entry);
    entry = null;
  };

  const start = (rawTitle: string) => {
    flush();
    const t = rawTitle.replace(/^\d+[.)]\s*/, "");
    const base = { text: t, title: t, fields: 0, priority: level };
    if (section === "mine")
      entry = { ...base, titleWeight: 3, owner: "me", kind: "reply", personal: true, reason: "Reply or decision expected from you" };
    else if (section === "team")
      entry = { ...base, titleWeight: 2, owner: "team", kind: "action", priority: level ?? "medium", reason: "Owned by your team" };
    else if (section === "customer")
      entry = { ...base, titleWeight: 1, owner: "others", kind: "follow_up", priority: level ?? "low", reason: "Waiting on customer" };
    else if (section === "notes")
      entry = { ...base, titleWeight: 1, strict: true, owner: "fyi", kind: "fyi", priority: "low", reason: "New email worth noting" };
    else if (section === "engagements")
      entry = { ...base, titleWeight: 1.5, strict: true, owner: "team", kind: "action", priority: level ?? "medium", engagement: true, reason: "Customer engagement" };
    else if (section === "completed")
      entry = { ...base, titleWeight: 0.5, strict: true, kind: "fyi", priority: "low", completed: true, reason: "Completed — no longer your action" };
    else entry = { ...base, titleWeight: 1.5, escalation: true, kind: "action", priority: "high", reason: "Escalation" };
  };

  const field = (rawName: string, value: string) => {
    if (!entry) return;
    entry.fields++;
    const name = rawName.toLowerCase().trim();
    const v = value.trim();
    if (!v || IGNORE_VALUE.test(v)) return;
    const note = (s: string) => (entry!.summary = entry!.summary ? `${entry!.summary} — ${s}` : s);

    if (name === "customer") entry.customer = v;
    else if (name === "subject") {
      entry.subject ??= v;
      entry.text += ` ${v}`;
      entry.matchText = `${entry.matchText ?? ""} ${v}`;
    }
    else if (name === "ticket") {
      entry.text += ` ${v}`;
      entry.matchText = `${entry.matchText ?? ""} ${v}`;
    } else if (name === "owner") {
      entry.ownerName = v.replace(/\s*\(.*\)\s*$/, "").replace(/\.$/, "");
      if (section === "mine" || section === "completed") return;
      if (isMe(v)) {
        entry.owner = "me";
        entry.reason = "You own the next action";
      } else if (section !== "customer" && section !== "notes") {
        entry.owner = "team";
        entry.reason = `Owned by ${entry.ownerName}`;
      }
    } else if (name === "current status" || name === "status") entry.status = v;
    else if (name === "last action by" || name === "from" || name === "sender") entry.from = v;
    else if (name === "customer waiting?") {
      if (/^y/i.test(v)) entry.reason = section === "mine" ? "Customer is waiting for your reply" : entry.reason;
    } else if (name.includes("waiting since")) entry.waitingSince = v.replace(/\.$/, "");
    else if (/^required action|^next action|^recommended action/.test(name)) entry.action ??= v;
    else if (name === "due date" || name === "due" || name === "deadline") entry.dueText = v;
    else if (name === "risk") {
      const lvl = levelIn(v);
      if (lvl) entry.risk = maxPriority(entry.risk, lvl);
      note(`Risk: ${v}`);
    } else if (name === "recommended reply" || name === "suggested reply") entry.suggestedReply = v;
    else if (name === "escalation probability") {
      const lvl = levelIn(v);
      entry.risk = maxPriority(entry.risk, lvl);
      entry.priority = maxPriority(entry.priority, lvl);
    } else if (name === "waiting on") note(`Waiting on: ${v}`);
    else if (name === "issue") {
      note(v);
      entry.matchText = `${entry.matchText ?? ""} ${v}`;
    }
    else if (name.includes("blocker")) {
      note(`Blocked by: ${v}`);
      entry.matchText = `${entry.matchText ?? ""} ${v}`;
    }
    else if (name.includes("last") && name.includes("update")) note(`Last update: ${v}`);
    else if (name === "days waiting") {
      if (/\d/.test(v)) entry.waitingSince ??= `${v.match(/\d+/)![0]} days`;
      else note(v);
    } else if (name.startsWith("next follow")) note(`Follow up: ${v}`);
    else if (name.startsWith("can close")) entry.canClose = /^y/i.test(v);
    else note(`${rawName.trim()}: ${v}`);
  };

  for (const line of lines) {
    if (!line || /^=+$/.test(line)) continue;

    const bottom = line.match(/^bottom line:\s*(.*)$/i);
    if (bottom) {
      flush();
      executiveSummary = bottom[1];
      section = "ignore";
      continue;
    }

    const next = sectionOf(line);
    if (next) {
      flush();
      section = next;
      level = undefined;
      table.reset();
      continue;
    }

    switch (section) {
      case "summary":
        for (const row of table.read(line)) {
          const value = Number(row.count);
          const label = (row.category ?? row.priority ?? "").replace(/^[^A-Za-z0-9]+/, "").trim();
          if (label && Number.isFinite(value)) counts.push({ label, value });
        }
        break;

      case "changes":
        if (!/^(none|no changes?)\b/i.test(line)) changes.push(line.replace(/^\d+[.)]\s*/, ""));
        break;

      case "mine":
      case "team":
      case "customer":
      case "notes":
      case "engagements":
      case "completed":
      case "escalations": {
        const lvl = levelOf(line);
        if (lvl) {
          flush();
          level = lvl;
          break;
        }
        const f = line.match(FIELD_RE);
        if (f && !/^(re|fw|fwd)$/i.test(f[1]) && f[1].split(/\s+/).length <= 6) {
          field(f[1], f[2]);
        } else if (/^\d+[.)]\s+/.test(line) || !(line.endsWith(".") && line.length > 30)) {
          start(line);
        } else {
          // a description line right under a title (assigned inside start(), so TS can't see it)
          const e = entry as (Mention & { fields: number }) | null;
          if (e && e.fields === 0) e.summary = e.summary ? `${e.summary} ${line}` : line;
        }
        break;
      }

      case "aging": {
        const lvl = levelOf(line);
        if (lvl) {
          level = lvl;
          break;
        }
        merger.add({ text: line, title: line.replace(/\.$/, ""), titleWeight: 0, passing: true, risk: level, reason: `Aging (${level ?? "flagged"})` });
        break;
      }

      case "top":
        for (const row of table.read(line)) {
          const rank = Number(row["#"] ?? row["priority #"] ?? row.rank);
          const task = row.task;
          if (!task || !Number.isFinite(rank)) continue;
          const who = row.owner ?? "";
          const mine = isMe(who);
          merger.add({
            text: `${row.ticket ?? ""} ${task}`,
            matchText: row.ticket,
            title: task,
            titleWeight: 0,
            passing: true,
            topRank: rank,
            summary: row["why it matters"] ?? row["expected outcome"],
            kind: "action",
            priority: rank <= 3 ? "high" : "medium",
            owner: who ? (mine ? "me" : "team") : undefined,
            ownerName: who && !mine ? who : undefined,
            reason: who ? (mine ? `Top ${rank} priority — yours` : `Top ${rank} priority — owned by ${who}`) : `Top ${rank} priority`,
          });
        }
        break;
    }
  }
  flush();

  // Yours beats your team's beats the customer's: if any section says the next move is
  // yours, it's yours.
  const precedence: Owner[] = ["me", "team", "others", "fyi"];
  const pick = (a: Acc) => precedence.map((o) => a.owners.find((x) => x.owner === o)).find(Boolean);

  const items: BriefItem[] = merger.items
    .filter((a) => a.title)
    .map((a) => {
      const vote = pick(a);
      // Completed beats everything except Section A itself still listing it as mine.
      const done = a.completed && !a.personal; // `personal` is set only by Section A ("My actions")
      const owner: Owner = done ? "fyi" : (vote?.owner ?? "team");
      const ownerReason = done ? "Completed — no longer your action" : vote?.reason || a.reasons[0] || "Not assigned to you";
      const priority = maxPriority(a.priority ?? "medium", a.risk && priorityRank[a.risk] >= 3 ? a.risk : undefined)!;
      const kind: ItemKind = owner === "me" ? (a.kind ?? "action") : owner === "others" ? "follow_up" : "action";
      const due = dueFromText(a.dueText.join(" "));
      const { score, quadrant } = rankItem({ priority, owner, kind, due, topRank: a.topRank, escalation: a.escalation, personal: a.personal });
      const refs = [...a.refs];
      return {
        id: itemId(refs, a.subject ?? a.title!),
        subject: a.subject,
        kind,
        priority,
        title: a.title!,
        from: a.from.join(", ") || undefined,
        customer: a.customer,
        summary: a.summary.join(" — ") || undefined,
        status: a.status,
        action: a.action,
        stage: a.stage,
        refs,
        owner,
        ownerReason,
        ownerName: owner === "me" ? undefined : a.ownerName,
        waitingOnCustomer: owner !== "others" && a.owners.some((x) => x.owner === "others") ? true : undefined,
        engagement: a.engagement || undefined,
        completed: done || undefined,
        suggestedReply: a.suggestedReply,
        canClose: a.canClose || undefined,
        topRank: a.topRank,
        due,
        waitingSince: a.waitingSince,
        risk: a.risk,
        escalation: a.escalation || undefined,
        personal: a.personal || undefined,
        score,
        quadrant,
      };
    });

  // "What changed today" lines flag the items they mention (by ticket number).
  for (const line of changes) {
    const refs = refsIn(line);
    for (const item of items) if (item.refs.some((r) => refs.includes(r))) item.changedToday = true;
  }

  const date = parseLooseDate(lines.slice(0, 5).join(" "));
  return { format: "ownership", title, date, items: sortItems(items), meetings: [], counts, executiveSummary, changes };
}
