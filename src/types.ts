export type Quadrant = "do" | "schedule" | "delegate" | "later";

export interface Meeting {
  id: string;
  time: string;
  title: string;
}

export interface FlaggedEmail {
  id: string;
  sender: string;
  subject: string;
  badge: "to-you" | "mentioned";
}

export interface AwaitingReply {
  id: string;
  recipient: string;
  subject: string;
  daysWaiting: number;
}

export interface CandidateTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  fromName: string;
  fromEmail: string;
  suggestedDue: string;
  suggestedProject: string;
  sourceSubject: string;
}

export type HistoryAction = "added" | "snoozed" | "dismissed";

export interface HistoryEntry {
  id: string;
  date: string; // ISO date, e.g. "2026-09-06"
  time: string; // e.g. "07:04 AM"
  title: string;
  action: HistoryAction;
  quadrant?: Quadrant;
}

export interface Digest {
  syncedAt: string;
  meetings: Meeting[];
  freeHoursToday: number;
  unreadCount: number;
  flagged: FlaggedEmail[];
  awaitingReply: AwaitingReply[];
  candidateTasks: CandidateTask[];
}
