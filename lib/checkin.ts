import { currentWeek, setTaskStatus } from "./plan";
import type { CheckinResult } from "./schemas/agents";
import type { PivotProfile } from "./types";

export type CheckinRecord = PivotProfile["checkins"][number];
type Task = PivotProfile["plan"]["weeks"][number]["tasks"][number];

const half = (x: number) => Math.round(x * 2) / 2;
const unfinished = (t: Task) => t.status === "todo" || t.status === "skipped";

// The week a check-in is about: the one the person is on (the first with something still to do).
export const checkinWeek = (p: PivotProfile) => Math.max(1, Math.min(currentWeek(p), p.plan.weeks.length));

// Tasks the agent may tick or skip: this week's, plus older ones still not done.
export function candidateTasks(p: PivotProfile, weekN: number): Task[] {
  const week = p.plan.weeks.find((w) => w.n === weekN);
  const earlier = p.plan.weeks.filter((w) => w.n < weekN).flatMap((w) => w.tasks.filter(unfinished));
  return [...(week?.tasks ?? []), ...earlier];
}

export function checkinInput(p: PivotProfile, weekN: number, transcript: string) {
  const week = p.plan.weeks.find((w) => w.n === weekN);
  return {
    transcript,
    hoursPerWeek: p.goal.hoursPerWeek,
    week: {
      n: weekN,
      theme: week?.theme ?? "",
      plannedHours: week?.hours ?? 0,
      tasks: (week?.tasks ?? []).map((t) => ({ id: t.id, title: t.title, hours: t.estHours, status: t.status })),
    },
    earlierUnfinished: p.plan.weeks
      .filter((w) => w.n < weekN)
      .flatMap((w) => w.tasks.filter(unfinished).map((t) => ({ id: t.id, title: t.title, week: w.n, hours: t.estHours })))
      .slice(0, 8),
  };
}

// Tick what was finished, mark what was skipped, and log the hours. Only ids that really are in the plan count.
export function applyCheckin(p: PivotProfile, weekN: number, r: CheckinResult, transcript: string, now: string, id: string = crypto.randomUUID()): { profile: PivotProfile; record: CheckinRecord } {
  const allowed = new Map(candidateTasks(p, weekN).map((t) => [t.id, t]));
  const completed = [...new Set(r.completedTaskIds)].filter((tid) => allowed.has(tid) && allowed.get(tid)!.status !== "done");
  const skipped = [...new Set(r.skippedTaskIds)].filter((tid) => allowed.has(tid) && !completed.includes(tid) && allowed.get(tid)!.status !== "done");

  let next = p;
  for (const tid of completed) next = setTaskStatus(next, tid, "done");
  for (const tid of skipped) next = setTaskStatus(next, tid, "skipped");

  const hours = Math.max(0, Math.min(80, half(r.hoursSpent)));
  const week = p.plan.weeks.find((w) => w.n === weekN);
  const record: CheckinRecord = {
    id,
    weekN,
    at: now,
    transcript,
    parsed: {
      hoursSpent: hours,
      completedTaskIds: completed,
      skippedTaskIds: skipped,
      blockers: r.blockers.map((b) => b.trim()).filter(Boolean).slice(0, 5),
      mood: Math.max(1, Math.min(5, Math.round(r.mood))),
      wins: r.wins.map((w) => w.trim()).filter(Boolean).slice(0, 5),
      notes: r.notes.trim(),
      plannedHours: week?.hours,
      hoursPerWeekFromNow: r.hoursPerWeekFromNow >= 1 && r.hoursPerWeekFromNow <= 60 ? Math.round(r.hoursPerWeekFromNow) : undefined,
      coachMessage: r.coachMessage.trim() || undefined,
    },
    planAdjustments: [],
  };
  return { profile: { ...next, checkins: [...next.checkins.filter((c) => c.id !== id), record] }, record };
}

// Something the person could say, built from this week's own tasks, so the screen can be tried without a mic.
// "rough" loses the whole week (this is what triggers a real trade-off); "partial" finishes one task and skips the rest.
export function exampleWeek(p: PivotProfile, weekN: number, kind: "partial" | "rough" = "partial"): string {
  const tasks = p.plan.weeks.find((w) => w.n === weekN)?.tasks.filter(unfinished) ?? [];
  if (!tasks.length) return "";
  const short = (t: Task) => t.title.replace(/[.s]+$/, "").replace(/^(w)/, (c) => c.toLowerCase());
  if (kind === "rough" || tasks.length === 1)
    return `This week was a write-off. Work was hectic and my evenings disappeared, so I did not manage ${tasks.map(short).join(" or ")}. I skipped all of it. Maybe 2 hours in total.`;
  const [first, ...rest] = tasks;
  return `This week I finished ${short(first)}. I did not get to ${rest.map(short).join(" or ")} because of a release crunch at work. In total about ${Math.max(1, first.estHours + 1)} hours.`;
}
