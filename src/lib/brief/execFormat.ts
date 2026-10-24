import { dueFromText, hashId, maxPriority, rankItem, refsIn, sortItems, toPriority } from "./common";
import type { BriefCount, BriefItem, BriefMeeting, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Reader for the "EXECUTIVE WORK BRIEF" layout: "=====" dividers, section headings
 * (REQUIRES MY RESPONSE TODAY, ESCALATIONS, OPEN SUPPORT INCIDENTS, UAT TRACKER,
 * CUSTOMER FOLLOW-UP, RISKS, TOP 10, PERSONAL ATTENTION) and tables pasted as
 * tab-separated text (or markdown pipes).
 *
 * The same ticket shows up in several sections, so every mention is merged into
 * one item: by ticket number first, otherwise by matching subject keywords.
 */

export function looksLikeExecutiveBrief(text: string) {
  return /EXECUTIVE SUMMARY/.test(text) && /(REQUIRES MY RESPONSE|OPEN SUPPORT INCIDENTS|TOP \d+ PRIORITIES|PERSONAL ATTENTION)/.test(text);
}

type Section =
  | "summary"
  | "requires"
  | "escalations"
  | "incidents"
  | "tracker"
  | "followup"
  | "risks"
  | "top"
  | "plan"
  | "personal"
  | "ignore";

function sectionOf(line: string): Section | null {
  const t = line.replace(/^[^A-Za-z0-9]+/, "").trim().toLowerCase();
  if (!t || t.length > 60 || line !== line.toUpperCase()) return null; // headings are upper case
  if (/^executive summary/.test(t)) return "summary";
  if (/^requires my response/.test(t)) return "requires";
  if (/^escalations/.test(t)) return "escalations";
  if (/^open support incidents/.test(t)) return "incidents";
  if (/(uat|release|deployment) .*tracker/.test(t)) return "tracker";
  if (/^customer follow-?up/.test(t)) return "followup";
  if (/^risks/.test(t)) return "risks";
  if (/top \d+ priorities/.test(t)) return "top";
  if (/work plan/.test(t)) return "plan";
  if (/^personal attention/.test(t)) return "personal";
  if (/^executive work brief/.test(t)) return "ignore";
  return null;
}

/** Sub-groups inside OPEN SUPPORT INCIDENTS and what they imply about whose move it is. */
const INCIDENT_GROUPS: { re: RegExp; owner: Owner | "auto"; stage: string; reason: string; priority: Priority }[] = [
  { re: /^waiting for customer/i, owner: "others", stage: "waiting", reason: "Waiting on customer", priority: "medium" },
  { re: /^waiting for /i, owner: "me", stage: "investigation", reason: "Customer is waiting on your team", priority: "high" },
  { re: /^under investigation/i, owner: "me", stage: "investigation", reason: "Under investigation", priority: "medium" },
  { re: /^pending rca/i, owner: "me", stage: "rca", reason: "RCA pending from your team", priority: "high" },
  { re: /^pending validation/i, owner: "auto", stage: "validation", reason: "Pending validation", priority: "medium" },
  { re: /^pending deployment/i, owner: "auto", stage: "deployment", reason: "Pending deployment", priority: "medium" },
  { re: /^pending uat/i, owner: "auto", stage: "uat", reason: "Pending UAT", priority: "medium" },
  { re: /^completed awaiting closure/i, owner: "me", stage: "closure", reason: "Ready to close", priority: "low" },
];

/** Next-step wording that means someone else has the ball. */
const OTHERS_RE =
  /\b(customer (?:verification|confirmation|signoff|sign-off|feedback)|signoff|sign-off|await(?:ing)? (?:customer|user|signoff|sign-off|confirmation|feedback|response)|uat confirmation|follow up with|chase)\b/i;

const HEADER_WORDS = [
  "ticket",
  "summary",
  "owner",
  "current owner",
  "next action",
  "next action required",
  "target date",
  "current state",
  "status",
  "cr / incident",
  "cr/incident",
  "environment",
  "blocking item",
  "customer",
  "last message",
  "last customer message",
  "days waiting",
  "action needed",
  "#",
  "priority #",
  "rank",
  "task",
  "expected outcome",
  "estimated impact",
  "priority",
  "count",
  "category",
  "why it matters",
];
// Longest first so "next action required" wins over "next action".
const HEADERS_BY_LENGTH = [...HEADER_WORDS].sort((a, b) => b.length - a.length);

export type Row = Record<string, string>;

/**
 * Tables lose their structure when copied: cells are tab separated and the
 * header's last cell is often glued to the first data cell ("CountNeed My Reply").
 * This splits a header line off and returns rows keyed by header name.
 */
export class TableReader {
  private headers: string[] = [];

  reset() {
    this.headers = [];
  }

  read(line: string): Row[] {
    const isPipe = line.startsWith("|");
    if (isPipe && /^\|?[\s:|-]+\|?$/.test(line)) return []; // markdown separator row
    if (!isPipe && !line.includes("\t")) return [];
    const cells = line
      .split(isPipe ? "|" : "\t")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    let rest = cells;
    if (this.headers.length === 0) {
      const headers: string[] = [];
      let i = 0;
      for (; i < cells.length; i++) {
        const lower = cells[i].toLowerCase();
        if (HEADER_WORDS.includes(lower)) {
          headers.push(lower);
          continue;
        }
        const glued = HEADERS_BY_LENGTH.find((h) => lower.startsWith(h) && lower.length > h.length);
        if (glued && headers.length > 0) {
          headers.push(glued);
          cells[i] = cells[i].slice(glued.length).trim();
        }
        break;
      }
      if (headers.length < 2) return [];
      this.headers = headers;
      rest = cells.slice(i);
    }

    const rows: Row[] = [];
    for (let i = 0; i < rest.length; i += this.headers.length) {
      const row: Row = {};
      this.headers.forEach((h, j) => {
        if (rest[i + j] !== undefined) row[h] = rest[i + j];
      });
      if (Object.keys(row).length) rows.push(row);
    }
    return rows;
  }
}

// --- Merging mentions into items ------------------------------------------------

const STOPWORDS = new Set(
  (
    "the and for with from that this into not are was has have been will can may your you our out new all any via per due " +
    "over under after before than then them they its re fw fwd follow up review respond reply provide update updates pending " +
    "issue issues request requested requests check monitor obtain validate validation verify verification coordinate continue " +
    "complete confirm prepare send chase support customer customers activants team status action next today tomorrow week " +
    "item items task tasks fix fixed problem incident ticket uat sit prod production deployment deploy deployed environment " +
    "progress maintained open queries questions function enhancement cr md awaiting response technical"
  ).split(" "),
);

/** Significant words, crudely stemmed (first 6 letters) so "interfaced" ≈ "interface". */
export function keywords(text: string): Set<string> {
  const out = new Set<string>();
  const cleaned = text.replace(REF_STRIP, " ");
  for (const raw of cleaned.split(/[^A-Za-z0-9]+/)) {
    if (!raw) continue;
    const acronym = raw.length >= 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw);
    if (raw.length < 3 && !acronym) continue;
    const w = raw.toLowerCase();
    if (STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    out.add((w.length > 4 ? w.replace(/([^s])s$/, "$1") : w).slice(0, 6)); // "fields" ≈ "field", "assess" kept
  }
  return out;
}
/** All-caps words of 3+ letters (e.g. GST, ABC) — distinctive enough to match on their own. */
function acronymsIn(text: string): Set<string> {
  return new Set((text.replace(REF_STRIP, " ").match(/\b[A-Z]{3,}\b/g) ?? []).map((w) => w.toLowerCase().slice(0, 6)).filter((w) => !STOPWORDS.has(w)));
}
const REF_STRIP = /\b(?:INC|SR|IN|CR|CHG|RITM|REQ|PRB)\d{5,}\b|\b[A-Z][A-Z0-9]*-\d{6,}\b/g;

export interface Acc {
  refs: Set<string>;
  words: Set<string>;
  title?: string;
  titleWeight: number; // higher-quality sources overwrite lower ones
  from: string[];
  customer?: string;
  kind?: ItemKind;
  priority?: Priority;
  risk?: Priority;
  escalation: boolean;
  personal: boolean;
  status?: string;
  action?: string;
  summary: string[];
  dueText: string[];
  waitingSince?: string;
  stage?: string;
  owners: { owner: Owner; reason: string }[];
  reasons: string[];
  topRank?: number;
  ownerName?: string;
  suggestedReply?: string;
  canClose?: boolean;
}

export interface Mention {
  text: string; // used for ticket refs and keyword matching
  passing?: boolean; // a reference to an item (Top 10 row, risk line) rather than an item itself
  matchText?: string; // extra words for matching (e.g. an escalation's description)
  title?: string;
  titleWeight?: number;
  from?: string;
  customer?: string;
  kind?: ItemKind;
  priority?: Priority;
  risk?: Priority;
  escalation?: boolean;
  personal?: boolean;
  status?: string;
  action?: string;
  summary?: string;
  dueText?: string;
  waitingSince?: string;
  stage?: string;
  owner?: Owner;
  reason?: string;
  topRank?: number;
  ownerName?: string;
  suggestedReply?: string;
  canClose?: boolean;
}

export class Merger {
  items: Acc[] = [];

  find(refs: string[], words: Set<string>, acronyms: Set<string>, passing: boolean): Acc | undefined {
    if (refs.length) {
      const byRef = this.items.find((a) => refs.some((r) => a.refs.has(r)));
      if (byRef) return byRef;
    }
    // Keyword match — never across two different ticket numbers. Needs 2+ shared words
    // covering most of the shorter description, or one distinctive acronym only one item has.
    let best: Acc | undefined;
    let bestScore = 0;
    for (const a of this.items) {
      if (refs.length && a.refs.size) continue;
      let score = 0;
      for (const w of words) if (a.words.has(w)) score++;
      const coverage = score / Math.max(1, Math.min(words.size, a.words.size));
      // 4+ shared words always count; a passing mention (Top 10 row, aging line) needs 3;
      // otherwise the shared words must cover most of the shorter description.
      const strong = score >= 4 || (passing && score >= 3);
      if (score >= 2 && !strong && coverage < 0.6) continue;
      if (score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
    if (bestScore >= 2) return best;
    // One shared word is enough only for a distinctive acronym (e.g. GST, ABC) held by a
    // single item — and only for a passing mention (a Top-10 row, a risk line) without its
    // own ticket number, never to fold one real item into another.
    if (passing && !refs.length) {
      for (const w of acronyms) {
        const holders = this.items.filter((a) => a.words.has(w));
        if (holders.length === 1) return holders[0];
      }
    }
    return undefined;
  }

  add(m: Mention): Acc {
    const refs = refsIn(m.text);
    const matchText = `${m.title ?? m.text} ${m.matchText ?? ""}`;
    const words = keywords(matchText);
    let acc = this.find(refs, words, acronymsIn(m.title ?? m.text), !!m.passing);
    if (!acc) {
      acc = { refs: new Set(), words: new Set(), titleWeight: -1, from: [], escalation: false, personal: false, summary: [], dueText: [], owners: [], reasons: [] };
      this.items.push(acc);
    }
    refs.forEach((r) => acc.refs.add(r));
    words.forEach((w) => acc.words.add(w));
    if (m.title && (m.titleWeight ?? 0) > acc.titleWeight) {
      acc.title = m.title;
      acc.titleWeight = m.titleWeight ?? 0;
    }
    if (m.from && !acc.from.includes(m.from)) acc.from.push(m.from);
    acc.customer ??= m.customer;
    if (m.kind && (!acc.kind || m.kind === "reply")) acc.kind = m.kind;
    acc.priority = maxPriority(acc.priority, m.priority);
    acc.risk = maxPriority(acc.risk, m.risk);
    acc.escalation ||= !!m.escalation;
    acc.personal ||= !!m.personal;
    acc.status ??= m.status;
    acc.action ??= m.action;
    if (m.summary && !acc.summary.includes(m.summary)) acc.summary.push(m.summary);
    if (m.dueText) acc.dueText.push(m.dueText);
    acc.waitingSince ??= m.waitingSince;
    acc.stage ??= m.stage;
    if (m.owner) acc.owners.push({ owner: m.owner, reason: m.reason ?? "" });
    else if (m.reason) acc.reasons.push(m.reason);
    if (m.topRank && (!acc.topRank || m.topRank < acc.topRank)) acc.topRank = m.topRank;
    acc.ownerName ??= m.ownerName;
    acc.suggestedReply ??= m.suggestedReply;
    acc.canClose ??= m.canClose;
    return acc;
  }
}

/** "INC0012345 - Disposal eForms …" or a summary cell → title with the ticket kept in front. */
function titled(ticket: string | undefined, summary: string | undefined) {
  if (ticket && summary && !summary.includes(ticket)) return `${ticket} · ${summary}`;
  return summary || ticket || "";
}

const FIELD_RE =
  /^(subject|ticket|status|customer waiting since|waiting since|required action|next action|action|deadline|due|why important|risk|owner|target date|summary):\s*(.*)$/i;

// --- Parser -----------------------------------------------------------------------

export function parseExecutiveBrief(text: string): ParsedBrief {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const title = lines.find((l) => l.length > 0 && !/^=+$/.test(l)) ?? "Executive Work Brief";
  const merger = new Merger();
  const table = new TableReader();
  const counts: BriefCount[] = [];
  const meetings: BriefMeeting[] = [];
  let executiveSummary: string | undefined;

  let section: Section | null = null;
  let group: (typeof INCIDENT_GROUPS)[number] | null = null;
  let level: Priority | undefined;
  let block: Mention | null = null; // [HIGH] sender + fields in REQUIRES MY RESPONSE
  let label: string | undefined; // short heading before an escalation
  let entry: Mention | null = null; // escalation / personal-attention entry being collected

  const flushBlock = () => {
    if (block) merger.add(block);
    block = null;
  };
  const flushEntry = () => {
    if (entry && section === "personal" && /\b(meeting|meetings|dsu|stand-?up|sync)\b/i.test(entry.title ?? "")) {
      const when = entry.title!.match(/\(([^)]+)\)/)?.[1] ?? (/recurring|daily/i.test(entry.summary ?? "") ? "Recurring" : "");
      meetings.push({ id: hashId("m:" + entry.title), when, title: entry.title!.replace(/\s*\([^)]*\)\s*$/, "") });
    } else if (entry) merger.add(entry);
    entry = null;
  };

  for (const line of lines) {
    if (!line || /^=+$/.test(line)) continue;

    const bottom = line.match(/^bottom line:\s*(.*)$/i);
    if (bottom) {
      flushBlock();
      flushEntry();
      executiveSummary = bottom[1];
      section = "ignore";
      continue;
    }

    const next = sectionOf(line);
    if (next) {
      flushBlock();
      flushEntry(); // before switching, so the entry is filed under the section it came from
      section = next;
      group = null;
      level = undefined;
      label = undefined;
      table.reset();
      continue;
    }

    switch (section) {
      case "summary":
        for (const row of table.read(line)) {
          const value = Number(row.count);
          if (row.priority && Number.isFinite(value)) counts.push({ label: row.priority, value });
        }
        break;

      case "requires": {
        const head = line.match(/^\[(critical|high|medium|low)\]\s*(.+)$/i);
        if (head) {
          flushBlock();
          const [from, customer] = head[2].split(/\s+\/\s+/);
          block = {
            text: "",
            from: from?.trim(),
            customer: customer?.trim(),
            kind: "reply",
            priority: toPriority(head[1]),
            owner: "me",
            reason: "Waiting for your response",
            personal: true,
          };
          break;
        }
        const field = line.match(FIELD_RE);
        if (block && field) {
          const [, rawName, value] = field;
          const name = rawName.toLowerCase();
          if (name === "subject") {
            block.title = value;
            block.titleWeight = 3;
            block.text += " " + value;
          } else if (name === "ticket") block.text += " " + value;
          else if (name === "status") block.status = value;
          else if (name.includes("since")) block.waitingSince = value.replace(/\.$/, "");
          else if (name.includes("action")) block.action = value;
          else if (name === "deadline" || name === "due") block.dueText = value;
          else block.summary = block.summary ? `${block.summary} ${value}` : value;
        }
        break;
      }

      case "escalations": {
        const refs = refsIn(line);
        if (refs.length) {
          flushEntry();
          const bare = line.replace(/^open\s+/i, "");
          const weak = keywords(bare).size < 2; // e.g. "INC0012345" or "Problem P-260000001"
          entry = {
            text: line,
            title: weak && label ? `${refs[0]} · ${label}` : bare,
            titleWeight: weak ? 0.5 : 2,
            escalation: true,
            priority: /critical/i.test(label ?? "") ? "critical" : "high",
            risk: /critical|production/i.test(label ?? "") ? "critical" : "high",
            stage: /rca/i.test(label ?? "") ? "rca" : undefined,
            summary: label,
            owner: "me",
            reason: label ? `Escalation: ${label}` : "Escalation",
          };
        } else if (line.length <= 45 && !line.endsWith(".")) {
          flushEntry();
          label = line;
        } else if (entry) {
          entry.summary = entry.summary ? `${entry.summary} — ${line}` : line;
          entry.matchText = `${entry.matchText ?? ""} ${line}`;
        }
        break;
      }

      case "incidents": {
        const g = INCIDENT_GROUPS.find((x) => x.re.test(line));
        if (g && !line.includes("\t")) {
          group = g;
          table.reset();
          break;
        }
        for (const row of table.read(line)) {
          const ticket = row.ticket;
          const next = row["next action"] ?? row["next action required"];
          const state = row["current state"] ?? row.status;
          const owner = group?.owner === "auto" ? (OTHERS_RE.test(`${next ?? ""} ${state ?? ""}`) ? "others" : "me") : group?.owner;
          const ticketRef = refsIn(ticket ?? "")[0];
          const subjectCell = ticket && !ticketRef ? ticket : undefined;
          merger.add({
            text: `${ticket ?? ""} ${row.summary ?? ""}`,
            title: subjectCell ?? titled(ticketRef, row.summary ?? ticket),
            titleWeight: 1,
            summary: subjectCell ? row.summary : undefined,
            status: state,
            action: next,
            dueText: row["target date"],
            stage: group?.stage,
            kind: owner === "others" ? "follow_up" : "action",
            priority: group?.priority ?? "medium",
            owner,
            reason: owner === "others" ? (group?.owner === "auto" ? `${group.reason} — waiting on customer` : group?.reason) : group?.reason,
          });
        }
        break;
      }

      case "tracker":
        for (const row of table.read(line)) {
          const ticket = row["cr / incident"] ?? row["cr/incident"] ?? row.ticket ?? "";
          const next = row["next action"] ?? row["next action required"];
          const blocking = row["blocking item"];
          const others = OTHERS_RE.test(`${blocking ?? ""} ${next ?? ""}`);
          merger.add({
            text: ticket,
            title: ticket,
            titleWeight: 1,
            status: [row.environment, row.status].filter(Boolean).join(": "),
            action: next,
            summary: blocking ? `Blocked by: ${blocking}` : undefined,
            stage: /deploy/i.test(row.status ?? "") ? "deployment" : "uat",
            kind: others ? "follow_up" : "action",
            priority: "medium",
            owner: others ? "others" : "me",
            reason: others ? `Blocked on ${blocking ?? "others"}` : "UAT / release step is on your team",
          });
        }
        break;

      case "followup":
        for (const row of table.read(line)) {
          const ticket = row.ticket ?? "";
          merger.add({
            text: ticket,
            title: ticket,
            titleWeight: 0,
            customer: row.customer,
            summary: row["last message"] ?? row["last customer message"],
            action: row["action needed"],
            waitingSince: row["days waiting"] ? `${row["days waiting"]} days` : undefined,
            priority: "high",
            owner: "me",
            reason: `Customer waiting${row.customer ? ` (${row.customer})` : ""}`,
          });
        }
        break;

      case "risks": {
        const lvl = toPriority(line);
        if (lvl && line.split(/\s+/).length === 1) {
          level = lvl;
          break;
        }
        merger.add({
          text: line,
          title: line.replace(/\.$/, ""),
          titleWeight: 0,
          passing: true,
          risk: level,
          priority: level === "critical" ? "high" : "medium",
          reason: `Risk: ${level ?? "flagged"}`,
        });
        break;
      }

      case "top":
        for (const row of table.read(line)) {
          const rank = Number(row["#"] ?? row["priority #"] ?? row.rank);
          const task = row.task;
          if (!task || !Number.isFinite(rank)) continue;
          merger.add({
            text: task,
            title: task,
            titleWeight: 0,
            passing: true,
            topRank: rank,
            summary: row["expected outcome"] ?? row["estimated impact"],
            kind: "action",
            priority: rank <= 3 ? "high" : "medium",
            reason: `Top ${rank} priority today`,
          });
        }
        break;

      case "personal": {
        const lvl = toPriority(line);
        if (lvl && line.split(/\s+/).length === 1) {
          flushEntry();
          level = lvl;
          break;
        }
        if (!entry || (line.length <= 60 && !line.endsWith("."))) {
          flushEntry();
          entry = {
            text: line,
            title: line,
            titleWeight: 1,
            personal: true,
            priority: level,
            kind: "action",
            owner: "me",
            reason: "Needs your personal attention",
          };
        } else {
          entry.summary = entry.summary ? `${entry.summary} ${line}` : line;
        }
        break;
      }
    }
  }
  flushBlock();
  flushEntry();

  const items: BriefItem[] = merger.items
    .filter((a) => a.title)
    .map((a) => {
      const mine = a.owners.find((o) => o.owner === "me");
      const theirs = a.owners.find((o) => o.owner === "others");
      // If any section says the next move is yours, it's pending you. Items only named in
      // Risks / Top 10 (no section says who's waiting) are treated as yours.
      const owner: Owner = mine ? "me" : theirs ? "others" : "me";
      const ownerReason = (mine ?? theirs)?.reason || a.reasons[0] || "Mentioned in the brief";
      const priority = maxPriority(a.priority ?? "medium", a.risk)!;
      const kind: ItemKind = a.kind ?? (owner === "others" ? "follow_up" : "action");
      const due = dueFromText(a.dueText.join(" "));
      const { score, quadrant } = rankItem({ priority, owner, kind, due, topRank: a.topRank, escalation: a.escalation, personal: a.personal });
      const refs = [...a.refs];
      return {
        id: hashId("x:" + (refs[0] ?? a.title!.toLowerCase().replace(/^(re|fw|fwd):\s*/i, ""))),
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

  return { format: "executive", title, items: sortItems(items), meetings, counts, executiveSummary };
}
