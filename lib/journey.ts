import { planProgress } from "./plan";
import type { PivotProfile } from "./types";

export type StepState = "done" | "doing" | "todo";

// Where the person is on each of the eight screens, derived from the profile (never stored).
export function journey(p: PivotProfile): { states: Record<string, StepState>; pct: number } {
  const plan = planProgress(p);
  const states: Record<string, StepState> = {
    "/intake": p.story.summary && p.goal.targetRole ? "done" : p.story.rawTranscripts.length ? "doing" : "todo",
    "/skills": p.skills.length ? "done" : p.targetRole.jds.length ? "doing" : "todo",
    "/plan": p.plan.weeks.length ? (plan.pct >= 100 ? "done" : "doing") : "todo",
    "/projects": p.projects.some((x) => x.status === "done") ? "done" : p.projects.length ? "doing" : "todo",
    "/interview": p.interviews.some((i) => i.finishedAt) ? "done" : p.interviews.length ? "doing" : "todo",
    "/checkin": p.checkins.length >= 2 ? "done" : p.checkins.length ? "doing" : "todo",
    "/tracker": p.applications.some((a) => a.status !== "saved") ? "done" : p.applications.length ? "doing" : "todo",
    "/wispr": p.settings.wisprProInstalled ? "done" : "todo",
  };
  const score = Object.values(states).reduce((s, v) => s + (v === "done" ? 1 : v === "doing" ? 0.5 : 0), 0);
  return { states, pct: Math.round((score / 8) * 100) };
}
