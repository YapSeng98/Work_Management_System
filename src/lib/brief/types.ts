import type { Quadrant } from "../../types";

export type Priority = "critical" | "high" | "medium" | "low";
export type ItemKind = "reply" | "action" | "decision" | "follow_up" | "fyi";
/**
 * me = the next move is yours; team = a colleague owns the next move (not your task);
 * others = waiting on the customer / a third party; fyi = no action.
 */
export type Owner = "me" | "team" | "others" | "fyi";

export interface BriefItem {
  id: string;
  kind: ItemKind;
  priority: Priority;
  title: string;
  subject?: string; // the email subject, when the report gives one (identity across layouts)
  from?: string;
  customer?: string;
  summary?: string;
  status?: string;
  action?: string;
  timeline?: string;
  stage?: string;
  refs: string[];
  owner: Owner;
  ownerReason: string;
  ownerName?: string; // who owns it, when the brief names someone
  suggestedReply?: string;
  canClose?: boolean;
  waitingOnCustomer?: boolean; // also listed as waiting on the customer
  changedToday?: boolean; // named in "What changed today"
  engagement?: boolean; // from a customer-engagement / decision-support section
  completed?: boolean; // listed as completed / no longer my action
  category?: string; // e.g. "RCA", "Deployment", "Decisions Support"
  source?: string; // e.g. "Support folder", "Inbox"
  possible?: boolean; // "possible action": ownership unclear, verify before acting
  recipientType?: "to" | "cc";
  lastReceived?: string; // when the latest email in the thread arrived (as given)
  ageHours?: number; // age of the latest email
  replyRequired?: boolean; // listed under "Emails requiring my reply"
  topRank?: number;
  due: string; // "Today", "Tomorrow", "This week", "Overdue", a short date, or ""
  dueDate?: string; // exact ISO date when the source gives one (JSON block)
  waitingSince?: string;
  risk?: Priority;
  escalation?: boolean;
  personal?: boolean;
  score: number;
  quadrant: Quadrant;
}

export interface BriefMeeting {
  id: string;
  when: string;
  title: string;
}

export interface BriefCount {
  label: string;
  value: number;
}

export interface ParsedBrief {
  format: "json" | "ownership" | "priority" | "executive" | "daily";
  title: string;
  date?: Date;
  items: BriefItem[];
  meetings: BriefMeeting[];
  counts: BriefCount[];
  executiveSummary?: string;
  changes?: string[]; // "What changed today" lines
}
