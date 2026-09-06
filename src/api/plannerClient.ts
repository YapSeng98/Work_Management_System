import type { CandidateTask, Quadrant } from "../types";

/**
 * Stubbed integration layer for Personal-Planning (ServiceNow-backed).
 * Every function here is a placeholder until we've seen the real
 * `pps/auth` contract and the `task` table schema from the Planner repo —
 * swap the bodies for real fetch() calls without touching call sites.
 */

export interface CreateTaskInput {
  title: string;
  quadrant: Quadrant;
  due: string;
  project: string;
  source: "outlook";
  sourceEmail: string;
}

export async function createTaskInPlanner(input: CreateTaskInput): Promise<{ id: string }> {
  console.info("[plannerClient] would POST to Planner's task table:", input);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { id: `stub-${Date.now()}` };
}

export function candidateToCreateInput(
  candidate: CandidateTask,
  overrides: Partial<Pick<CreateTaskInput, "title" | "quadrant" | "due" | "project">> = {},
): CreateTaskInput {
  return {
    title: overrides.title ?? candidate.title,
    quadrant: overrides.quadrant ?? candidate.quadrant,
    due: overrides.due ?? candidate.suggestedDue,
    project: overrides.project ?? candidate.suggestedProject,
    source: "outlook",
    sourceEmail: candidate.fromEmail,
  };
}
