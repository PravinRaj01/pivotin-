import { buildSkeleton, scheduleMilestones, type PlannedMilestone } from "./planner";
import type { PivotProfile } from "./types";

// The weekly re-plan. No model is involved: after a check-in, unfinished work is packed into the remaining
// weeks within the hours the person has. If it does not fit, the choices are exact: drop a topic, or add weeks.

type Week = PivotProfile["plan"]["weeks"][number];
type Task = Week["tasks"][number];

const half = (x: number) => Math.round(x * 2) / 2;
const unfinished = (t: Task) => t.status === "todo" || t.status === "skipped";
const baseId = (id: string) => id.replace(/c\d+$/, "");
const sum = (ts: Task[]) => half(ts.reduce((s, t) => s + t.estHours, 0));
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 864e5).toISOString().slice(0, 10);

export type ReflowInput = {
  fromWeek: number; // first week to rebuild: the week after the check-in
  extraWeeks?: number; // push the deadline by this many weeks
  hoursPerWeek?: number; // defaults to the current goal
  dropSkills?: string[]; // topics the person chose to drop
};

export type Reflow = {
  fromWeek: number;
  totalWeeks: number;
  hoursPerWeek: number;
  extraWeeks: number;
  weeks: Week[]; // the rebuilt weeks, fromWeek to totalWeeks
  placedWeek: Map<string, number>; // task id -> week it now sits in
  carried: Task[]; // copies of unfinished tasks from before fromWeek
  dropped: Task[]; // unfinished work with no place left
  droppedHours: number;
  droppedSkillIds: string[];
  milestones: PlannedMilestone[];
  unchanged: boolean; // nothing was left over, so the weeks ahead are exactly as they were
  needHours: number; // all unfinished work
  capacityHours: number; // all hours available in the weeks that are left
};

// Where in the plan each skill first appears; this is the order skills were ranked in (more job descriptions first,
// prerequisites before dependents). The later a skill starts, the sooner it is dropped.
function skillRank(p: PivotProfile): Map<string, number> {
  const rank = new Map<string, number>();
  for (const w of p.plan.weeks) for (const t of w.tasks) if (t.kind === "learn") for (const id of t.skillIds) if (!rank.has(id)) rank.set(id, w.n);
  return rank;
}

export function reflow(p: PivotProfile, input: ReflowInput): Reflow {
  const L = p.plan.weeks.length;
  const extra = input.extraWeeks ?? 0;
  const totalWeeks = L + extra;
  const H = input.hoursPerWeek ?? p.goal.hoursPerWeek;
  const from = input.fromWeek;
  const drop = new Set(input.dropSkills ?? []);
  const rank = skillRank(p);
  const rankOf = (t: Task) => rank.get(t.skillIds[0] ?? "") ?? 999;

  // What still has to be done, with where it sits now.
  const pool: { t: Task; w: number; i: number }[] = [];
  const doneIn = new Map<number, Task[]>();
  for (const w of p.plan.weeks)
    w.tasks.forEach((t, i) => {
      if (unfinished(t)) pool.push({ t, w: w.n, i });
      else if (t.status === "done" && w.n >= from) doneIn.set(w.n, [...(doneIn.get(w.n) ?? []), t]);
    });
  // A checkpoint (a milestone with no project step behind it) is a placeholder that is rebuilt every time; it is never carried or dropped.
  const isCheckpoint = (t: Task) => t.kind === "milestone" && t.milestoneIdx === undefined;
  // Nothing left over and nothing asked to change: leave the weeks ahead alone.
  if (!pool.some((x) => x.w < from) && extra === 0 && H === p.goal.hoursPerWeek && drop.size === 0) {
    const ahead = p.plan.weeks.filter((w) => w.n >= from);
    const same = new Map(ahead.flatMap((w) => w.tasks.map((t) => [t.id, w.n] as const)));
    const need = sum(pool.filter((x) => !isCheckpoint(x.t)).map((x) => x.t));
    return { fromWeek: from, totalWeeks, hoursPerWeek: H, extraWeeks: 0, weeks: ahead, placedWeek: same, carried: [], dropped: [], droppedHours: 0, droppedSkillIds: [], milestones: [], unchanged: true, needHours: need, capacityHours: need };
  }
  const learnPool = pool.filter((x) => x.t.kind === "learn");
  const msPool = pool.filter((x) => x.t.kind === "milestone" && !isCheckpoint(x.t));
  const wrapPool = pool.filter((x) => x.t.kind === "wrap");

  // Week structure for what is left: blocks of 2 or 3 weeks, each ending in a project milestone, then the closing weeks.
  const closing = p.plan.weeks.filter((w) => w.wrap && w.n >= from).length; // the closing weeks stay; added weeks go to learning
  const sk = buildSkeleton({ ...p, goal: { ...p.goal, hoursPerWeek: H } }, [], { fromWeek: from, totalWeeks, wrapWeeks: closing });
  const blockOffset = Math.max(0, ...p.plan.weeks.filter((w) => w.n < from).map((w) => w.block ?? 0));
  const projects = p.projects;
  const planned = scheduleMilestones(sk, projects);

  const room = new Map<number, number>();
  const placed = new Map<number, Task[]>();
  const placedWeek = new Map<string, number>();
  const carried: Task[] = [];
  const dropped: Task[] = [];
  const doneH = (n: number) => sum(doneIn.get(n) ?? []);
  for (const w of sk.weeks) room.set(w.n, Math.max(0, H - doneH(w.n)));

  const copy = (x: { t: Task; w: number }, week: number): Task => {
    const wasPast = x.w < from;
    const t: Task = { ...x.t, status: "todo", movedTo: undefined };
    if (wasPast) {
      const c: Task = { ...t, id: `${baseId(x.t.id)}c${from - 1}`, carriedFrom: x.t.carriedFrom ?? x.w };
      carried.push(c);
      placedWeek.set(c.id, week);
      return c;
    }
    placedWeek.set(t.id, week);
    return t;
  };
  const put = (week: number, t: Task) => placed.set(week, [...(placed.get(week) ?? []), t]);

  // 1. Project milestones go to the block-end weeks.
  const usedMs = new Set<string>();
  for (const m of planned) {
    const hit = msPool.find((x) => x.t.projectId === m.projectId && x.t.milestoneIdx === (m.idx >= 0 ? m.idx : undefined) && !usedMs.has(x.t.id));
    let t: Task;
    if (hit) {
      usedMs.add(hit.t.id);
      t = copy(hit, m.week);
      t = { ...t, estHours: Math.min(t.estHours, m.hours) };
    } else {
      const proj = projects.find((x) => x.id === m.projectId);
      t = { id: `k${m.week}c${from - 1}`, title: m.title, skillIds: (proj?.skillIds ?? []).slice(0, 3), estHours: m.hours, kind: "milestone", projectId: m.projectId || undefined, milestoneIdx: m.idx >= 0 ? m.idx : undefined, status: "todo" };
      placedWeek.set(t.id, m.week);
    }
    put(m.week, t);
    room.set(m.week, Math.max(0, (room.get(m.week) ?? 0) - t.estHours));
  }
  for (const x of msPool) if (!usedMs.has(x.t.id)) dropped.push(x.t);

  // 2. Learning tasks, most important skill first, into the weeks with room, in order (never backwards).
  const learnWeeks = sk.weeks.filter((w) => w.kind !== "wrap").map((w) => w.n);
  const queue = learnPool
    .filter((x) => !drop.has(x.t.skillIds[0] ?? ""))
    .sort((a, b) => rankOf(a.t) - rankOf(b.t) || a.w - b.w || a.i - b.i);
  for (const x of learnPool) if (drop.has(x.t.skillIds[0] ?? "")) dropped.push(x.t);
  let wi = 0;
  let lastLearnWeek = learnWeeks[0] ?? from;
  while (queue.length && wi < learnWeeks.length) {
    const wn = learnWeeks[wi];
    let left = room.get(wn) ?? 0;
    let took = true;
    while (took && queue.length) {
      took = false;
      // the first task that fits, looking at most 3 ahead and only within the same skill, so order is kept
      for (let k = 0; k < Math.min(3, queue.length); k++) {
        if (k > 0 && rankOf(queue[k].t) !== rankOf(queue[0].t)) break;
        if (queue[k].t.estHours <= left + 1e-9) {
          const [x] = queue.splice(k, 1);
          put(wn, copy(x, wn));
          left = half(left - x.t.estHours);
          lastLearnWeek = wn;
          took = true;
          break;
        }
      }
    }
    room.set(wn, left);
    wi++;
  }
  for (const x of queue) dropped.push(x.t);

  // 3. Closing tasks go in the closing weeks (or the end of the plan when it is too short to have any).
  const wrapWeeks = sk.weeks.filter((w) => w.kind === "wrap").map((w) => w.n);
  const wrapTargets = wrapWeeks.length ? wrapWeeks : learnWeeks.filter((n) => n >= lastLearnWeek);
  const wrapQueue = [...wrapPool].sort((a, b) => a.w - b.w || a.i - b.i);
  for (const wn of wrapTargets) {
    let left = room.get(wn) ?? 0;
    while (wrapQueue.length && wrapQueue[0].t.estHours <= left + 1e-9) {
      const [x] = wrapQueue.splice(0, 1);
      put(wn, copy(x, wn));
      left = half(left - x.t.estHours);
    }
    room.set(wn, left);
  }
  for (const x of wrapQueue) dropped.push(x.t);

  // 4. Weeks with nothing in them still get something sensible to do.
  for (const w of sk.weeks) {
    const have = (placed.get(w.n)?.length ?? 0) + (doneIn.get(w.n)?.length ?? 0);
    if (have) continue;
    const hrs = Math.max(1, Math.min(room.get(w.n) ?? 0, w.kind === "wrap" ? H : 3));
    const t: Task = w.kind === "wrap"
      ? { id: `x${w.n}c${from - 1}`, title: "Practise interviews and send applications", skillIds: [], estHours: hrs, kind: "wrap", status: "todo" }
      : { id: `x${w.n}c${from - 1}`, title: "Revisit this block's skills with a small practice exercise", skillIds: [], estHours: hrs, kind: "learn", status: "todo" };
    put(w.n, t);
    placedWeek.set(t.id, w.n);
  }

  // 5. Build the weeks.
  const themeById = new Map<string, string>();
  for (const w of p.plan.weeks) for (const t of w.tasks) themeById.set(baseId(t.id), w.theme);
  const skillLabel = (id?: string) => p.skills.find((s) => s.id === id)?.label;
  const weeks: Week[] = sk.weeks.map((w) => {
    const tasks = [...(doneIn.get(w.n) ?? []), ...(placed.get(w.n) ?? [])];
    const learn = tasks.filter((t) => t.kind === "learn" && t.status !== "done");
    const themes = new Set(learn.map((t) => themeById.get(baseId(t.id))));
    const theme =
      w.kind === "wrap" ? "Interviews and applications" : themes.size === 1 && [...themes][0] ? [...themes][0]! : (skillLabel(learn.find((t) => t.skillIds[0])?.skillIds[0]) ?? (tasks.some((t) => t.kind === "milestone") ? "Project milestone" : "Practice"));
    return { n: w.n, theme, hours: sum(tasks), tasks, block: w.block + blockOffset, blockEnd: w.blockEnd, wrap: w.kind === "wrap" || undefined };
  });

  const droppedHours = sum(dropped);
  return {
    fromWeek: from,
    totalWeeks,
    hoursPerWeek: H,
    extraWeeks: extra,
    weeks,
    placedWeek,
    carried,
    dropped,
    droppedHours,
    droppedSkillIds: [...new Set(dropped.flatMap((t) => (t.kind === "learn" ? t.skillIds.slice(0, 1) : [])))],
    milestones: planned,
    unchanged: false,
    needHours: sum(pool.filter((x) => !isCheckpoint(x.t)).map((x) => x.t)),
    capacityHours: half(sk.weeks.reduce((s, w) => s + H - doneH(w.n), 0)),
  };
}

// ---------- applying a choice ----------

export type Choice = { extraWeeks?: number; dropSkills?: string[] };

export function applyReplan(p: PivotProfile, rf: Reflow, summary: string, reason: string, now: string): PivotProfile {
  const from = rf.fromWeek;
  const past = p.plan.weeks
    .filter((w) => w.n < from)
    .map((w) => ({
      ...w,
      tasks: w.tasks.map((t) => {
        if (!unfinished(t)) return t;
        const to = rf.placedWeek.get(`${baseId(t.id)}c${from - 1}`);
        return to ? { ...t, status: "moved" as const, movedTo: to } : { ...t, status: "skipped" as const, movedTo: undefined };
      }),
    }));

  const placed = new Set(rf.weeks.flatMap((w) => w.tasks.map((t) => t.skillIds[0])).filter(Boolean) as string[]);
  const uncovered = [...new Set([...p.plan.uncovered, ...rf.droppedSkillIds.filter((id) => !placed.has(id))])];
  const projects = rf.unchanged ? p.projects : p.projects.map((pr) => ({
    ...pr,
    milestones: pr.milestones.map((m, i) => {
      const hit = rf.milestones.find((x) => x.projectId === pr.id && x.idx === i);
      return m.done ? m : hit ? { ...m, week: hit.week, hours: hit.hours } : { ...m, week: undefined };
    }),
  }));

  return {
    ...p,
    goal: {
      ...p.goal,
      hoursPerWeek: rf.hoursPerWeek,
      timelineWeeks: p.goal.timelineWeeks + rf.extraWeeks,
      deadline: p.goal.deadline && rf.extraWeeks ? addDays(p.goal.deadline, 7 * rf.extraWeeks) : p.goal.deadline,
    },
    projects,
    plan: {
      ...p.plan,
      generatedAt: now,
      revision: p.plan.revision + 1,
      weeks: [...past, ...rf.weeks],
      uncovered,
      changelog: [{ at: now, reason, summary }, ...p.plan.changelog].slice(0, 20),
    },
  };
}

// ---------- the analysis the screen shows ----------

export type DropCandidate = { skillId: string; label: string; hours: number; tasks: number; share: number; reflow: Reflow };
export type Analysis = {
  weekN: number;
  fromWeek: number;
  hoursPerWeek: number;
  unfinishedHours: number; // work from this week and earlier that is not done
  behind: boolean;
  base: Reflow; // what happens with no change to the deadline and no topic dropped
  push?: { weeks: number; fits: boolean; reflow: Reflow; deadline?: string };
  drops: DropCandidate[]; // topics that could be dropped, lowest priority first
};

export function analyze(p: PivotProfile, weekN: number, hoursPerWeek?: number): Analysis {
  const from = weekN + 1;
  const H = hoursPerWeek ?? p.goal.hoursPerWeek;
  const base = reflow(p, { fromWeek: from, hoursPerWeek: H });
  const behind = base.droppedHours > 0.01;
  const unfinishedHours = sum(p.plan.weeks.filter((w) => w.n <= weekN).flatMap((w) => w.tasks.filter(unfinished)));
  const out: Analysis = { weekN, fromWeek: from, hoursPerWeek: H, unfinishedHours, behind, base, drops: [] };
  if (!behind) return out;

  // Push the deadline: the fewest extra weeks that make everything fit.
  let pushed: Reflow | undefined;
  let k = 1;
  for (; k <= 8; k++) {
    pushed = reflow(p, { fromWeek: from, hoursPerWeek: H, extraWeeks: k });
    if (pushed.droppedHours <= 0.01) break;
  }
  const fits = !!pushed && pushed.droppedHours <= 0.01;
  out.push = { weeks: Math.min(k, 8), fits, reflow: pushed!, deadline: p.goal.deadline ? addDays(p.goal.deadline, 7 * Math.min(k, 8)) : undefined };

  // Drop a topic: skills with unfinished learning tasks, the one asked for least first.
  const rank = skillRank(p);
  const bySkill = new Map<string, Task[]>();
  for (const w of p.plan.weeks) for (const t of w.tasks) if (unfinished(t) && t.kind === "learn" && t.skillIds[0]) bySkill.set(t.skillIds[0], [...(bySkill.get(t.skillIds[0]) ?? []), t]);
  out.drops = [...bySkill.entries()]
    .sort((a, b) => (rank.get(b[0]) ?? 999) - (rank.get(a[0]) ?? 999))
    .slice(0, 5)
    .map(([skillId, tasks]) => ({
      skillId,
      label: p.skills.find((s) => s.id === skillId)?.label ?? skillId,
      hours: sum(tasks),
      tasks: tasks.length,
      share: p.targetRole.requirements.find((r) => r.skillId === skillId)?.frequency ?? 0,
      reflow: reflow(p, { fromWeek: from, hoursPerWeek: H, dropSkills: [skillId] }),
    }));
  return out;
}

// ---------- before and after ----------

export type DiffItem = { task: Task; change: "same" | "moved-in" | "moved-out" | "carried" | "dropped" | "new"; note?: string };
export type WeekDiff = { n: number; before: DiffItem[]; after: DiffItem[]; hoursBefore: number; hoursAfter: number; isNew: boolean };
export type PlanDiff = { weeks: WeekDiff[]; moved: number; carried: number; dropped: number; newWeeks: number };

// Compare two plans week by week. A task is the same task if it has the same id; carried copies say where they came from.
export function diffPlans(beforeAll: Week[], afterAll: Week[]): PlanDiff {
  // Checkpoints are placeholders that are rebuilt on every re-plan; they are not part of the comparison.
  const noCheckpoints = (ws: Week[]) => ws.map((w) => ({ ...w, tasks: w.tasks.filter((t) => !(t.kind === "milestone" && t.milestoneIdx === undefined)) }));
  const before = noCheckpoints(beforeAll);
  const after = noCheckpoints(afterAll);
  const loc = (ws: Week[]) => new Map(ws.flatMap((w) => w.tasks.filter((t) => t.status === "todo").map((t) => [t.id, w.n] as const)));
  const was = loc(before);
  const now = loc(after);
  const out: WeekDiff[] = [];
  let moved = 0, carried = 0, dropped = 0;
  const all = new Set([...before.map((w) => w.n), ...after.map((w) => w.n)]);
  for (const n of [...all].sort((a, b) => a - b)) {
    const b = before.find((w) => w.n === n);
    const a = after.find((w) => w.n === n);
    const beforeItems: DiffItem[] = (b?.tasks ?? []).map((t) => {
      if (t.status === "done") return { task: t, change: "same" as const };
      const nowIn = now.get(t.id);
      const aTask = a?.tasks.find((x) => x.id === t.id);
      if (nowIn === n && aTask?.status === "todo") return { task: t, change: "same" as const };
      if (nowIn !== undefined && nowIn !== n) return { task: t, change: "moved-out" as const, note: `moves to week ${nowIn}` };
      if (aTask?.status === "moved") return { task: t, change: "moved-out" as const, note: `carried to week ${aTask.movedTo}` };
      return { task: t, change: "dropped" as const, note: "dropped" };
    });
    const afterItems: DiffItem[] = (a?.tasks ?? []).map((t) => {
      if (t.status === "done") return { task: t, change: "same" as const };
      if (t.status === "moved") return { task: t, change: "moved-out" as const, note: `carried to week ${t.movedTo}` };
      if (t.status === "skipped") return { task: t, change: "same" as const };
      const was0 = was.get(t.id);
      if (was0 === n) return { task: t, change: "same" as const };
      if (was0 !== undefined) return { task: t, change: "moved-in" as const, note: `from week ${was0}` };
      if (t.carriedFrom) return { task: t, change: "carried" as const, note: `carried from week ${t.carriedFrom}` };
      return { task: t, change: "new" as const, note: "new" };
    });
    const changed = beforeItems.some((i) => i.change !== "same") || afterItems.some((i) => i.change !== "same");
    if (!changed) continue;
    moved += afterItems.filter((i) => i.change === "moved-in").length;
    carried += afterItems.filter((i) => i.change === "carried").length;
    dropped += beforeItems.filter((i) => i.change === "dropped").length;
    out.push({ n, before: beforeItems, after: afterItems, hoursBefore: sum((b?.tasks ?? []).filter((t) => t.status !== "done" && t.status !== "moved" && t.status !== "skipped")), hoursAfter: sum((a?.tasks ?? []).filter((t) => t.status === "todo")), isNew: !b });
  }
  return { weeks: out, moved, carried, dropped, newWeeks: out.filter((w) => w.isNew).length };
}
