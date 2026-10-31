import type { PlanWeeksResult, ProjectsResult, SequenceResult } from "./schemas/agents";
import {
  RESOURCES,
  assembleWeeks,
  tidy,
  buildSkeleton,
  orderSkills,
  sanitizeDeps,
  scheduleMilestones,
  weakSkills,
  weeksAvailable,
  type AgentWeek,
  type PlannedMilestone,
  type Skeleton,
} from "./planner";
import type { PivotProfile } from "./types";

// Builds (or re-builds from a given week) the whole plan: prerequisites, order, projects, schedule, tasks.
// `call` is the way to reach an agent, so the browser screen and a Node script share this code.
export type Call = <T>(route: string, input: unknown) => Promise<T>;
export type Step = { label: string; pct: number };

const CHUNK = 8; // weeks written per agent call
const MAX_DEP_SKILLS = 24;

export async function buildPlan(
  p0: PivotProfile,
  opts: { fromWeek?: number; reason: string; today: string; call: Call; onStep?: (s: Step) => void },
): Promise<PivotProfile> {
  const { call, today } = opts;
  const step = (label: string, pct: number) => opts.onStep?.({ label, pct });
  const from = opts.fromWeek ?? 1;
  const total = weeksAvailable(p0, today);
  if (p0.goal.hoursPerWeek <= 0) throw new Error("Tell me how many hours a week you have first (step 1).");
  if (total < from) throw new Error("There are no weeks left before your deadline. Move the deadline in your story (step 1).");

  let weak = weakSkills(p0);
  if (!weak.length) throw new Error("You already meet the bar for every skill, so there is nothing to plan. Add a job description to raise the bar.");

  // 1. Which skills depend on which (asked once, then remembered on the skill).
  step("Working out what to learn first", 5);
  let p: PivotProfile = p0;
  const priority = (w: (typeof weak)[number]) => w.share * 100 + w.gap * 5 + w.importance;
  const asked = [...weak].sort((a, b) => priority(b) - priority(a)).slice(0, MAX_DEP_SKILLS);
  const missingDeps = asked.filter((w) => w.skill.dependsOn === undefined);
  let depNote = "";
  if (missingDeps.length) {
    try {
      const r = await call<SequenceResult>("sequence", { targetRole: p.goal.targetRole, skills: asked.map((w) => ({ skillId: w.id, label: w.label, category: w.skill.category })) });
      const raw: Record<string, string[]> = {};
      for (const d of r.dependsOn) raw[d.skillId] = d.prerequisites;
      const clean = sanitizeDeps(raw, asked.map((w) => w.id));
      p = { ...p, skills: p.skills.map((s) => (clean[s.id] !== undefined ? { ...s, dependsOn: clean[s.id] } : s)) };
    } catch {
      depNote = " Prerequisites could not be read this time, so the order follows how often each skill is asked for.";
    }
  }
  weak = weakSkills(p);
  const deps: Record<string, string[]> = {};
  for (const s of p.skills) if (s.dependsOn) deps[s.id] = s.dependsOn;
  const order = orderSkills(weak, deps);

  // 2. The week-by-week skeleton: which skill, how many hours, which weeks end a block.
  const skeleton: Skeleton = buildSkeleton(p, order, { fromWeek: from, totalWeeks: total });
  const blockEnds = skeleton.weeks.filter((w) => w.blockEnd && w.kind !== "wrap").length;
  const covered = order.filter((w) => !skeleton.uncovered.includes(w.id));

  // 3. Projects (kept when re-planning part way through).
  step("Choosing portfolio projects", 15);
  let projects = p.projects;
  const keep = from > 1 && projects.some((pr) => pr.milestones.some((m) => !m.done));
  let projectNote = "";
  if (!keep) {
    try {
      const r = await call<ProjectsResult>("projects", {
        targetRole: p.goal.targetRole,
        milestoneSlots: blockEnds,
        // each project needs at least 2 milestones, so the slots decide how many projects fit (at most 3)
        projectCount: Math.max(1, Math.min(3, Math.floor(blockEnds / 2))),
        hoursPerMilestone: skeleton.milestoneHours,
        // biggest gap first, so projects close the skills that need the most proof
        skills: [...order].sort((x, y) => y.gap - x.gap || y.share - x.share).slice(0, 10).map((w) => ({
          skillId: w.id,
          label: w.label,
          gap: w.gap,
          askedForIn: `${Math.round(w.share * 100)}% of the job descriptions`,
          employerWording: p.targetRole.requirements.find((q) => q.skillId === w.id)?.targetWording ?? "",
        })),
        background: p.experience.map(({ role, org, achievements, toolsUsed }) => ({ role, org, achievements, toolsUsed })),
        preferences: p.story.preferences,
      });
      projects = shapeProjects(r, new Set(order.map((w) => w.id)), blockEnds, skeleton.milestoneHours);
    } catch {
      projectNote = " Projects could not be chosen this time; the milestone weeks are generic checkpoints.";
    }
  }
  const milestones: PlannedMilestone[] = scheduleMilestones(skeleton, projects);
  projects = projects.map((pr) => ({
    ...pr,
    milestones: pr.milestones.map((m, i) => {
      const hit = milestones.find((x) => x.projectId === pr.id && x.idx === i);
      return hit ? { ...m, week: hit.week, hours: hit.hours } : { ...m, week: m.done ? m.week : undefined };
    }),
  }));
  p = { ...p, projects };

  // 4. Write the tasks, a few weeks at a time.
  const agentWeeks: AgentWeek[] = [];
  const weeks = skeleton.weeks;
  for (let i = 0; i < weeks.length; i += CHUNK) {
    const part = weeks.slice(i, i + CHUNK);
    step(`Writing weeks ${part[0].n} to ${part[part.length - 1].n}`, 20 + Math.round((i / weeks.length) * 75));
    const r = await call<PlanWeeksResult>("plan", {
      goal: { targetRole: p.goal.targetRole, hoursPerWeek: p.goal.hoursPerWeek },
      preferences: p.story.preferences,
      projects: p.projects.map(({ id, title, pitch }) => ({ id, title, pitch })),
      resources: RESOURCES.map(({ id, title, provider, kind, cost, effort, topics }) => ({ id, title, provider, kind, cost, effort, topics })),
      weeks: part.map((w) => {
        const ms = milestones.find((m) => m.week === w.n);
        const proj = ms && p.projects.find((x) => x.id === ms.projectId);
        return {
          n: w.n,
          budgetHours: w.budget,
          kind: w.kind,
          slots: w.slots.map((s) => {
            const sk = p.skills.find((x) => x.id === s.skillId)!;
            return { slot: s.skillId, skill: sk.label, hours: s.hours, level: `${sk.current}->${sk.required}`, employerWording: sk.targetWording ?? "" };
          }),
          ...(ms ? { milestone: { slot: "milestone", project: proj?.title ?? "your portfolio", milestone: ms.title, hours: ms.hours } } : {}),
        };
      }),
    });
    agentWeeks.push(...r.weeks);
  }

  step("Checking the hours and links", 97);
  const written = assembleWeeks(p, skeleton, milestones, agentWeeks, p.plan.revision);
  const now = new Date().toISOString();
  const firstFew = covered.slice(0, 3).map((w) => w.label).join(", ");
  const summary =
    `${weeks.length} weeks from week ${from} at ${p.goal.hoursPerWeek} hours a week. First up: ${firstFew || "nothing"}. ` +
    `Covers ${covered.length} of ${order.length} skill gaps${skeleton.uncovered.length ? `; ${skeleton.uncovered.length} did not fit before your deadline` : ""}. ` +
    `A project milestone ends every block of 2 or 3 weeks.` +
    depNote +
    projectNote;

  return {
    ...p,
    plan: {
      generatedAt: now,
      revision: p.plan.revision + 1,
      weeks: [...p.plan.weeks.filter((w) => w.n < from), ...written],
      uncovered: skeleton.uncovered,
      changelog: [{ at: now, reason: opts.reason, summary }, ...p.plan.changelog].slice(0, 20),
    },
  };
}

// Turn the agent's project ideas into profile projects. Keeps only real skill ids, 2 or 3 per project.
export function shapeProjects(r: ProjectsResult, known: Set<string>, slots: number, hoursPerMilestone: number): PivotProfile["projects"] {
  // First keep the projects that are usable: 2 or 3 real gaps and at least 2 milestones.
  const usable = r.projects
    .map((raw) => ({
      raw,
      gaps: [...new Set(raw.closesGaps)].filter((id) => known.has(id)).slice(0, 3),
      titles: raw.milestones.map((t) => t.trim()).filter(Boolean).slice(0, 5),
    }))
    .filter((u) => u.gaps.length >= 2 && u.titles.length >= 2)
    .slice(0, 3);
  // Share the milestone slots fairly, at least 2 each. Trimming keeps the last one: it is the deliverable.
  const count = Math.max(0, Math.min(usable.length, Math.floor(slots / 2)));
  const out: PivotProfile["projects"] = [];
  usable.slice(0, count).forEach((u, i) => {
    const slotsLeft = slots - out.reduce((s, p) => s + p.milestones.length, 0);
    const fair = Math.max(2, Math.floor(slotsLeft / (count - i)));
    const take = Math.min(u.titles.length, fair);
    const titles = take < u.titles.length ? [...u.titles.slice(0, take - 1), u.titles[u.titles.length - 1]] : u.titles;
    out.push({
      id: `pr${out.length + 1}`,
      title: tidy(u.raw.title),
      pitch: tidy(u.raw.pitch),
      skillIds: u.gaps,
      deliverable: tidy(u.raw.deliverable),
      scopeHours: titles.length * hoursPerMilestone,
      oldFieldAngle: tidy(u.raw.oldFieldAngle),
      // A story about a project that is not done yet must leave the result blank.
      interviewStory: /\[[^\]]+\]/.test(u.raw.interviewStory) ? tidy(u.raw.interviewStory) : `${tidy(u.raw.interviewStory)} Result: [what changed because of your work, with a number].`,
      milestones: titles.map((title) => ({ title: tidy(title), done: false })),
      status: "suggested",
    });
  });
  return out;
}
