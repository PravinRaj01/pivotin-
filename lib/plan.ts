import type { PivotProfile } from "./types";

// Small helpers for reading and ticking the plan. Building the plan is in plan-run.ts and planner.ts.

// The week the person is on: the first one that still has something to do.
export function currentWeek(p: PivotProfile): number {
  const w = p.plan.weeks.find((x) => x.tasks.some((t) => t.status === "todo"));
  return w ? w.n : p.plan.weeks.length + 1;
}

export function planProgress(p: PivotProfile) {
  const tasks = p.plan.weeks.flatMap((w) => w.tasks);
  const done = tasks.filter((t) => t.status === "done").length;
  const hours = tasks.reduce((s, t) => s + t.estHours, 0);
  const hoursDone = tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.estHours, 0);
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0, hours, hoursDone };
}

function syncProject(p: PivotProfile, projectId: string, idx: number, done: boolean): PivotProfile {
  return {
    ...p,
    projects: p.projects.map((pr) => {
      if (pr.id !== projectId) return pr;
      const milestones = pr.milestones.map((m, i) => (i === idx ? { ...m, done } : m));
      const all = milestones.every((m) => m.done);
      return { ...pr, milestones, status: all ? "done" : milestones.some((m) => m.done) ? "active" : pr.status === "done" ? "active" : pr.status };
    }),
  };
}

// Ticking a project milestone in the plan also ticks it on the project, and the other way round.
export function toggleTask(p: PivotProfile, taskId: string): PivotProfile {
  let linked: { projectId: string; idx: number; done: boolean } | null = null;
  const weeks = p.plan.weeks.map((w) => ({
    ...w,
    tasks: w.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const status = t.status === "done" ? ("todo" as const) : ("done" as const);
      if (t.projectId && t.milestoneIdx !== undefined) linked = { projectId: t.projectId, idx: t.milestoneIdx, done: status === "done" };
      return { ...t, status };
    }),
  }));
  const next = { ...p, plan: { ...p.plan, weeks } };
  return linked ? syncProject(next, (linked as { projectId: string }).projectId, (linked as { idx: number }).idx, (linked as { done: boolean }).done) : next;
}

export function toggleMilestone(p: PivotProfile, projectId: string, idx: number): PivotProfile {
  const task = p.plan.weeks.flatMap((w) => w.tasks).find((t) => t.projectId === projectId && t.milestoneIdx === idx);
  if (task) return toggleTask(p, task.id);
  const done = !p.projects.find((x) => x.id === projectId)?.milestones[idx]?.done;
  return syncProject(p, projectId, idx, done);
}
