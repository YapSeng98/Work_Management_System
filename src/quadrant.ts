import type { Quadrant } from "./types";

export const quadrantLabel: Record<Quadrant, string> = {
  do: "Do",
  schedule: "Schedule",
  delegate: "Delegate",
  later: "Later",
};

export const quadrantStyle: Record<Quadrant, { bg: string; text: string }> = {
  do: { bg: "var(--do-bg)", text: "var(--do-text)" },
  schedule: { bg: "var(--schedule-bg)", text: "var(--schedule-text)" },
  delegate: { bg: "var(--delegate-bg)", text: "var(--delegate-text)" },
  later: { bg: "var(--later-bg)", text: "var(--later-text)" },
};

export const quadrantOrder: Quadrant[] = ["do", "schedule", "delegate", "later"];
