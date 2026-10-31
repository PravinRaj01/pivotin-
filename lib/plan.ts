import type { PlanResult } from "./schemas/plan";
import type { PivotProfile } from "./types";

type Week = PivotProfile["plan"]["weeks"][number];

const sumHours = (w: Week) => Math.round(w.tasks.reduce((s, t) => s + t.estHours, 0) * 10) / 10;

// The week the person is on: the first one that still has something to do.
export function currentWeek(p: PivotProfile): number {
  const w = p.plan.weeks.find((x) => x.tasks.some((t) => t.status === "todo"));
  return w ? w.n : p.plan.weeks.length + 1;
}

export function planProgress(p: PivotProfile) {
  const tasks = p.plan.weeks.flatMap((w) => w.tasks);
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

// Input for the plan agent. fromWeek > 1 means: keep earlier weeks, rewrite the rest.
export function planInput(p: PivotProfile, fromWeek: number, reason: string, extra?: unknown) {
  const done = p.plan.weeks.flatMap((w) => w.tasks.filter((t) => t.status === "done").map((t) => t.title));
  return {
    reason,
    person: { currentRole: p.person.currentRole, location: p.person.location },
    goal: {
      targetRole: p.goal.targetRole,
      targetIndustry: p.goal.targetIndustry,
      totalWeeks: p.goal.timelineWeeks,
      hoursPerWeek: p.goal.hoursPerWeek,
      constraints: p.goal.constraints,
    },
    fromWeek,
    weeksToWrite: Math.max(1, p.goal.timelineWeeks - fromWeek + 1),
    skills: [...p.skills]
      .sort((a, b) => b.required - b.current - (a.required - a.current))
      .map(({ id, label, current, required, status }) => ({ skillId: id, label, current, required, status })),
    projectIdeas: p.projects.map((x) => x.title),
    alreadyDone: done.slice(-20),
    ...(extra ? { extra } : {}),
  };
}

export function applyPlan(p: PivotProfile, r: PlanResult, fromWeek: number, reason: string): PivotProfile {
  const validIds = new Set(p.skills.map((s) => s.id));
  const keep = p.plan.weeks.filter((w) => w.n < fromWeek);
  const current = p.plan.weeks.find((w) => w.n === fromWeek);
  const doneInCurrent = current ? current.tasks.filter((t) => t.status === "done") : [];

  const seen = new Set<number>();
  const fresh: Week[] = r.weeks
    .filter((w) => w.n >= fromWeek && w.n <= p.goal.timelineWeeks && w.tasks.length && !seen.has(w.n) && seen.add(w.n))
    .sort((a, b) => a.n - b.n)
    .map((w) => {
      const tasks = w.tasks.map((t, i) => ({
        id: `w${w.n}t${i + 1}r${p.plan.revision + 1}`,
        title: t.title,
        skillIds: t.skillIds.filter((id) => validIds.has(id)),
        estHours: t.estHours,
        resourceHint: t.resourceHint,
        status: "todo" as const,
      }));
      const week: Week = { n: w.n, theme: w.theme, hours: 0, tasks: w.n === fromWeek ? [...doneInCurrent, ...tasks] : tasks };
      return { ...week, hours: sumHours(week) };
    });

  const now = new Date().toISOString();
  return {
    ...p,
    plan: {
      generatedAt: now,
      revision: p.plan.revision + 1,
      weeks: [...keep, ...fresh],
      changelog: [{ at: now, reason, summary: r.summary }, ...p.plan.changelog].slice(0, 20),
    },
  };
}

export function toggleTask(p: PivotProfile, taskId: string): PivotProfile {
  return {
    ...p,
    plan: {
      ...p.plan,
      weeks: p.plan.weeks.map((w) => ({
        ...w,
        tasks: w.tasks.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "todo" : "done" } : t)),
      })),
    },
  };
}
