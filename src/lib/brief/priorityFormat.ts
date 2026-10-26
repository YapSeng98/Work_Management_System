import { dueFromText, hashId, maxPriority, parseLooseDate, rankItem, sortItems } from "./common";
import { Merger, TableReader, type Mention } from "./execFormat";
import type { BriefCount, BriefItem, BriefMeeting, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Reader for the priority-section "Daily Work Brief": Critical / High / Medium / Other
 * pending actions, Waiting on customer, a Decisions Support summary, a support-ticket
 * summary, meetings and a "Top 5 Recommended Actions" list. Used when the AI leaves out
 * the JSON block (which is preferred when present).
 *
 * Everything in the priority sections is mine (the prompt only lists my actions); the
 * section sets the priority. Summary-table rows merge into those items by ticket number,
 * or become items owned by whoever they say is next.
 */

export function looksLikePriorityBrief(text: string) {
  return /critical actions/i.test(text) && /(high priority actions|waiting on customer|other pending actions)/i.test(text);
}

type Section = "summary" | "critical" | "high" | "medium" | "other" | "waiting" | "decisions" | "support" | "meetings" | "top" | "ignore";

function sectionOf(line: string): Section | null {
  if (/[:\t|]/.test(line) || line.length > 80) return null;
  const t = line.replace(/^[^A-Za-z0-9]+/, "").trim().toLowerCase();
  if (/^executive summary( table)?$/.test(t)) return "summary";
  if (/^critical actions?$/.test(t)) return "critical";
  if (/^high priority actions?$/.test(t)) return "high";
  if (/^medium priority actions?$/.test(t)) return "medium";
  if (/^(other|normal) (pending )?actions?$/.test(t)) return "other";
  if (/^waiting on (customer|others)\b/.test(t)) return "waiting";
  if (/^decisions? support( tickets?)? summary$/.test(t)) return "decisions";
  if (/support( tickets?)? summary$/.test(t)) return "support";
  if (/^meetings?\b.*(attention|approval|today)/.test(t)) return "meetings";
  if (/^top \d+ (recommended )?actions\b/.test(t)) return "top";
  if (/^(daily work brief|detailed work brief|machine-readable json|json)\b/.test(t)) return "ignore";
  return null;
}

const SECTION_PRIORITY: Partial<Record<Section, Priority>> = { critical: "critical", high: "high", medium: "medium", other: "low", waiting: "low" };
const FIELD_RE = /^([A-Za-z][A-Za-z ?/'()&-]{1,48}?)\s*:\s*(.*)$/;
const IGNORE_VALUE = /^(not stated|n\/a|none|tbd|unknown|-)\.?$/i;
const ME_RE = /^(me|myself|you|chung)\b/i;

export function parsePriorityBrief(text: string): ParsedBrief {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const title = lines.find((l) => l && !/^=+$/.test(l)) ?? "Daily Work Brief";
  const date = parseLooseDate(title);
  const merger = new Merger();
  const table = new TableReader();
  const counts: BriefCount[] = [];
  const meetings: BriefMeeting[] = [];
  let section: Section | null = null;
  let entry: (Mention & { fields: number; hasSubject?: boolean }) | null = null;

  const flush = () => {
    if (entry && entry.title) merger.add(entry);
    entry = null;
  };
  const start = (t?: string) => {
    flush();
    const owner: Owner = section === "waiting" ? "others" : "me";
    entry = {
      text: t ?? "",
      title: t?.replace(/^\d+[.)]\s*/, ""),
      titleWeight: 2,
      fields: 0,
      owner,
      kind: owner === "others" ? "follow_up" : "action",
      priority: SECTION_PRIORITY[section!] ?? "medium",
      escalation: section === "critical" || undefined,
      reason: owner === "others" ? "Waiting on customer" : "Needs your action",
    };
  };
  const field = (rawName: string, value: string) => {
    const name = rawName.toLowerCase().trim();
    const v = value.trim();
    if (name === "subject" && (!entry || entry.hasSubject)) start(v); // a new "Subject:" starts the next item
    if (!entry) start();
    const e = entry!;
    e.fields++;
    if (!v || IGNORE_VALUE.test(v)) return;
    const note = (s: string) => (e.summary = e.summary ? `${e.summary} — ${s}` : s);
    if (name === "subject") {
      e.hasSubject = true;
      e.text += ` ${v}`;
      e.matchText = `${e.matchText ?? ""} ${v}`;
      if (!e.title) e.title = v;
      else if (e.title !== v) note(v);
    } else if (/^(customer|customer\/system|system)$/.test(name)) e.customer = v;
    else if (/^(ticket|ticket number|incident|incident number)$/.test(name)) e.text += ` ${v}`;
    else if (/status/.test(name)) e.status = v;
    else if (/^why/.test(name)) note(v);
    else if (/^(required|next) action/.test(name)) e.action = v;
    else if (/^due/.test(name)) e.dueText = v;
    else if (/^risk/.test(name)) note(`Risk if delayed: ${v}`);
    else if (/^(owner|current owner)$/.test(name)) e.ownerName = v;
    else if (/^waiting on/.test(name)) note(`Waiting on: ${v}`);
    else if (/^category$/.test(name)) e.stage = v;
    else note(`${rawName.trim()}: ${v}`);
  };

  for (const line of lines) {
    if (!line || /^=+$/.test(line) || /^```/.test(line)) continue;
    if (line.startsWith("{")) section = "ignore"; // the JSON block, when present, is read elsewhere
    const next = sectionOf(line);
    if (next) {
      flush();
      section = next;
      table.reset();
      continue;
    }

    switch (section) {
      case "summary":
        for (const row of table.read(line)) {
          const value = Number(row.count);
          const label = (row.priority ?? row.category ?? "").replace(/^[^A-Za-z0-9]+/, "").trim();
          if (label && Number.isFinite(value)) counts.push({ label, value });
        }
        break;

      case "critical":
      case "high":
      case "medium":
      case "other":
      case "waiting": {
        const f = line.match(FIELD_RE);
        if (f && !/^(re|fw|fwd)$/i.test(f[1]) && f[1].split(/\s+/).length <= 6) field(f[1], f[2]);
        else if (/^\d+[.)]\s+/.test(line) || !(line.endsWith(".") && line.length > 40)) start(line);
        else if (entry) (entry as Mention).summary = `${(entry as Mention).summary ?? ""} ${line}`.trim();
        break;
      }

      case "decisions":
      case "support":
        for (const row of table.read(line)) {
          const ticket = row["ticket number"] ?? row.ticket ?? row["incident number"] ?? row.incident ?? "";
          const who = row["waiting on who"] ?? row["waiting on"] ?? row["current owner"] ?? row.owner ?? "";
          const owner: Owner = ME_RE.test(who) ? "me" : /customer|vendor|user|synapxe/i.test(who) ? "others" : "team";
          merger.add({
            text: `${ticket} ${row.topic ?? ""}`,
            title: row.topic ? `${ticket} · ${row.topic}` : ticket,
            titleWeight: 0.5,
            passing: true,
            customer: row.customer,
            status: row["current status"] ?? row.status,
            action: row["next action"],
            ownerName: owner === "team" ? who : undefined,
            stage: section === "decisions" ? "Decisions Support" : "Support ticket",
            kind: owner === "others" ? "follow_up" : "action",
            priority: "medium",
            owner,
            reason: owner === "me" ? "Waiting on you" : owner === "others" ? `Waiting on ${who || "customer"}` : `Owned by ${who || "your team"}`,
          });
        }
        break;

      case "meetings": {
        const m = line.replace(/^\d+[.)]\s*/, "");
        if (m.length > 3) {
          const time = m.match(/\b\d{1,2}[:.]\d{2}\s*(am|pm)?\b|\b\d{1,2}\s*(am|pm)\b/i)?.[0] ?? "";
          meetings.push({ id: hashId("m:" + m), when: time, title: m.replace(time, "").replace(/^[\s–—-]+|[\s–—-]+$/g, "") || m });
        }
        break;
      }

      case "top": {
        const m = line.match(/^(\d+)[.)]\s+(.+)$/);
        if (m) merger.add({ text: m[2], title: m[2], titleWeight: 0, passing: true, topRank: Number(m[1]), reason: `Top ${m[1]} today` });
        break;
      }
    }
  }
  flush();

  const items: BriefItem[] = merger.items
    .filter((a) => a.title)
    .map((a) => {
      const vote = a.owners.find((o) => o.owner === "me") ?? a.owners.find((o) => o.owner === "team") ?? a.owners[0];
      const owner: Owner = vote?.owner ?? "me";
      const priority = maxPriority(a.priority ?? "medium", undefined)!;
      const kind: ItemKind = owner === "others" ? "follow_up" : (a.kind ?? "action");
      const due = dueFromText(a.dueText.join(" "));
      const { score, quadrant } = rankItem({ priority, owner, kind, due, topRank: a.topRank, escalation: a.escalation });
      const refs = [...a.refs];
      return {
        id: hashId("p:" + (refs[0] ?? a.title!.toLowerCase().replace(/^(re|fw|fwd):\s*/i, ""))),
        kind,
        priority,
        title: a.title!,
        customer: a.customer,
        summary: a.summary.join(" — ") || undefined,
        status: a.status,
        action: a.action,
        stage: a.stage,
        refs,
        owner,
        ownerReason: vote?.reason || a.reasons[0] || "Needs your action",
        ownerName: owner === "team" ? a.ownerName : undefined,
        topRank: a.topRank,
        due,
        escalation: a.escalation || undefined,
        score,
        quadrant,
      };
    });

  return { format: "priority", title, date, items: sortItems(items), meetings, counts };
}
