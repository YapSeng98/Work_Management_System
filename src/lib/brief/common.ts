import type { Quadrant } from "../../types";
import type { BriefItem, ItemKind, Owner, Priority } from "./types";

/** Ticket-like references: INC0012345, SR1234567, IN1234567, ABCDE-202600001, P-260000001, … */
export const REF_RE = /\b(?:INC|SR|IN|CR|CHG|RITM|REQ|PRB)\d{5,}\b|\b[A-Z][A-Z0-9]*-\d{6,}\b/g;

export const TODAY_RE = /\b(eod|today|asap|urgent|immediately)\b/i;
export const WEEK_RE = /\b(end of (?:this )?week|this week|by (?:mon|tue|wed|thu|fri)[a-z]*)\b/i;

export function refsIn(text: string): string[] {
  return [...new Set(text.match(REF_RE) ?? [])];
}

export function hashId(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `b-${(h >>> 0).toString(36)}`;
}

export const priorityRank: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function maxPriority(a: Priority | undefined, b: Priority | undefined): Priority | undefined {
  if (!a) return b;
  if (!b) return a;
  return priorityRank[a] >= priorityRank[b] ? a : b;
}

export function toPriority(value: unknown): Priority | undefined {
  const v = String(value ?? "").toLowerCase().trim();
  return v === "critical" || v === "high" || v === "medium" || v === "low" ? v : undefined;
}

/** Due label for an ISO date relative to the brief's date. */
export function dueFromDate(iso: string, briefDate: Date): string {
  const due = new Date(iso + "T00:00:00");
  if (Number.isNaN(due.getTime())) return "";
  const base = new Date(briefDate.getFullYear(), briefDate.getMonth(), briefDate.getDate());
  const days = Math.round((due.getTime() - base.getTime()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return due.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Due label from free-text deadline wording ("EOD today", "end of this week", …). */
export function dueFromText(text: string): string {
  if (TODAY_RE.test(text)) return "Today";
  if (WEEK_RE.test(text)) return "This week";
  return "";
}

/**
 * Shared ranking for the executive and JSON formats. Higher score = more important;
 * the quadrant follows Eisenhower: Do (urgent + yours), Schedule, Delegate (others), Later.
 */
export function rankItem(s: {
  priority: Priority;
  owner: Owner;
  kind: ItemKind;
  due: string;
  topRank?: number;
  escalation?: boolean;
  personal?: boolean;
}): { score: number; quadrant: Quadrant } {
  const urgentDue = s.due === "Overdue" || s.due === "Today" || s.due === "Tomorrow";
  const score =
    { critical: 40, high: 30, medium: 20, low: 10 }[s.priority] +
    (s.topRank ? (11 - Math.min(s.topRank, 10)) * 4 : 0) + // the AI's own Top 10 carries real weight

    (s.due === "Overdue" || s.due === "Today" ? 15 : s.due === "Tomorrow" ? 10 : s.due ? 6 : 0) +
    (s.escalation ? 10 : 0) +
    (s.kind === "reply" ? 5 : 0) +
    (s.personal ? 5 : 0);

  let quadrant: Quadrant;
  if (s.owner === "fyi") quadrant = "later";
  else if (s.owner === "others" || s.owner === "team") quadrant = "delegate";
  else if (urgentDue || s.priority === "critical" || s.escalation || (s.topRank !== undefined && s.topRank <= 3)) quadrant = "do";
  else if (s.priority === "high" || s.topRank !== undefined || s.due) quadrant = "schedule";
  else quadrant = "later";
  return { score, quadrant };
}

const ownerOrder: Record<Owner, number> = { me: 0, team: 1, others: 2, fyi: 3 };

export function sortItems(items: BriefItem[]) {
  return items.sort((a, b) => ownerOrder[a.owner] - ownerOrder[b.owner] || b.score - a.score);
}
