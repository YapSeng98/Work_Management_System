import type { Digest, HistoryEntry } from "../types";

export const mockDigest: Digest = {
  syncedAt: "07:02 AM",
  freeHoursToday: 2.5,
  unreadCount: 5,
  meetings: [
    { id: "m1", time: "09:30", title: "Cosmetica sync" },
    { id: "m2", time: "13:00", title: "1FSS status review" },
    { id: "m3", time: "16:00", title: "1:1 with manager" },
  ],
  flagged: [
    {
      id: "f1",
      sender: "Han Xiao",
      subject: "Re: Cosmetica SN4 rework — needs sign-off by EOD",
      badge: "to-you",
    },
    {
      id: "f2",
      sender: "Finance Team",
      subject: "Q3 budget review moved to 3pm",
      badge: "to-you",
    },
    {
      id: "f3",
      sender: "IT Service Desk",
      subject: "Mentioned you in access request thread",
      badge: "mentioned",
    },
  ],
  awaitingReply: [
    { id: "a1", recipient: "Han Xiao", subject: "Contract terms — need your confirmation", daysWaiting: 1 },
    { id: "a2", recipient: "Priya Menon", subject: "Vendor quote — can you approve?", daysWaiting: 3 },
    { id: "a3", recipient: "Facilities Team", subject: "Desk move request follow-up", daysWaiting: 5 },
  ],
  candidateTasks: [
    {
      id: "c1",
      title: "Sign off on Cosmetica SN4 rework",
      quadrant: "do",
      fromName: "Han Xiao",
      fromEmail: "han.xiao@corp.com",
      suggestedDue: "Today",
      suggestedProject: "Cosmetica",
      sourceSubject: "Re: Cosmetica SN4 rework — needs sign-off by EOD",
    },
    {
      id: "c2",
      title: "Prep Q3 budget notes before 3pm",
      quadrant: "schedule",
      fromName: "Finance Team",
      fromEmail: "finance-team@corp.com",
      suggestedDue: "Today",
      suggestedProject: "Personal Work",
      sourceSubject: "Q3 budget review moved to 3pm",
    },
    {
      id: "c3",
      title: "Follow up on access request thread",
      quadrant: "delegate",
      fromName: "IT Service Desk",
      fromEmail: "it-servicedesk@corp.com",
      suggestedDue: "This week",
      suggestedProject: "1FSS",
      sourceSubject: "Mentioned you in access request thread",
    },
  ],
};

export const seedHistory: HistoryEntry[] = [
  {
    id: "h1",
    date: "2026-09-05",
    time: "07:01 AM",
    title: "Reschedule vendor call",
    action: "added",
    quadrant: "do",
  },
  {
    id: "h2",
    date: "2026-09-05",
    time: "07:03 AM",
    title: "Loop in facilities on desk move",
    action: "added",
    quadrant: "delegate",
  },
  {
    id: "h3",
    date: "2026-09-05",
    time: "07:06 AM",
    title: "Newsletter — Q3 all-hands recap",
    action: "dismissed",
  },
  {
    id: "h4",
    date: "2026-09-03",
    time: "07:02 AM",
    title: "Draft response to procurement",
    action: "added",
    quadrant: "schedule",
  },
];
