export type Quadrant = "do" | "schedule" | "delegate" | "later";

export type Tab = "today" | "tasks" | "history";

export interface Meeting {
  id: string;
  time: string;
  title: string;
}

export type HistoryAction = "taken" | "done" | "dismissed";

export interface HistoryEntry {
  id: string;
  date: string; // local ISO date, e.g. "2026-10-23"
  time: string; // e.g. "07:04 AM"
  title: string;
  action: HistoryAction;
  quadrant?: Quadrant;
}

/** A brief item the user has taken on ("Take" on the Today tab) — a real Planner task. */
export interface MyTask {
  id: string; // the Planner task's id
  title: string;
  quadrant: Quadrant;
  due: string;
  from?: string;
  action?: string;
  refs: string[];
  done: boolean;
  closedOn?: string; // local ISO date it was last changed, when done — "Closed today"
  score: number; // higher sorts first (from Planner priority and due date)
  rev: number | null; // Planner row revision, sent as base_rev on updates
}
