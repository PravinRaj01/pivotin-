import resourcesJson from "../data/resources.json";
import type { PivotProfile, Skill } from "./types";

// The deterministic half of planning. Code decides WHAT is scheduled WHEN (skill order, hour budgets,
// project milestones, which links exist). The agents only write the wording of each task.

export type Resource = {
  id: string;
  title: string;
  provider: string;
  url: string;
  kind: string;
  cost: string;
  effort: string;
  topics: string[];
  checkedOn: string;
};
export const RESOURCES = resourcesJson as Resource[];
export const resourceById = (id?: string) => RESOURCES.find((r) => r.id === id);

// ---------- is this link really about this task? ----------
// The agent proposes a resource, but code decides. A link is used only if it shares a meaningful word with
// the task or its skill; otherwise the best matching curated resource is used, otherwise none ("no curated
// resource"). Words found in many resources (like "product" or "data") say nothing, so they are ignored.

const STOP = new Set(["fundamentals", "fundamental", "foundations", "foundation", "essentials", "basics", "quick", "reference", "guide", "guides", "tutorial", "tutorials", "overview", "introduction", "intro", "course", "courses", "article", "articles", "learning", "help", "centre", "center", "resource", "resources", "template", "templates", "framework", "frameworks", "develop", "developing", "development", "developer", "high", "level", "detailed", "final", "finalize", "summary", "executive", "the", "and", "for", "you", "are", "not", "use", "how", "why", "its", "new", "one", "two", "all", "can", "per", "via", "out", "off", "set", "get", "try", "see", "with", "your", "from", "into", "that", "this", "using", "about", "their", "have", "will", "each", "than", "then", "them", "they", "what", "when", "where", "which", "while", "week", "weeks", "hours", "task", "tasks", "skill", "skills", "basic", "basics", "learn", "study", "write", "build", "draft", "create", "review", "practise", "practice", "apply", "make", "identify", "define", "produce"]);
export const stemsOf = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => (w.length >= 3 || w === "ux" || w === "ai") && !STOP.has(w))
      .map((w) => w.slice(0, 6)),
  );
// Only the curated topic tags count, not words from the title: "interactive" or "simple" in a title say nothing
// about what a resource teaches.
const TOPIC_STEMS = new Map(RESOURCES.map((r) => [r.id, stemsOf(r.topics.join(" "))]));
const DF = new Map<string, number>();
for (const set of TOPIC_STEMS.values()) for (const st of set) DF.set(st, (DF.get(st) ?? 0) + 1);
const COMMON = (st: string) => (DF.get(st) ?? 0) >= 6;

export function relevance(resourceId: string, text: string, context = ""): number {
  const topics = TOPIC_STEMS.get(resourceId);
  if (!topics) return 0;
  let n = 0;
  const seen = stemsOf(text);
  const add = (src: Set<string>, weight: number) => {
    // rarer topics say more: weight each match by how few resources carry that tag
    for (const st of src) if (topics.has(st) && !COMMON(st)) n += weight * Math.log(RESOURCES.length / (DF.get(st) ?? 1));
  };
  add(seen, 1);
  // words from the skill (not the task) count for less: the link should teach the skill, and match the task
  add(new Set([...stemsOf(context)].filter((x) => !seen.has(x))), 0.6);
  return n;
}

// Returns the id to use for a task, or undefined when the curated list has nothing relevant.
export function pickResource(proposed: string | null | undefined, text: string, used: Map<string, number>, context = ""): string | undefined {
  const ok = (id: string) => (used.get(id) ?? 0) < 2;
  const scored = RESOURCES.filter((r) => ok(r.id))
    .map((r) => ({ id: r.id, s: relevance(r.id, text, context) }))
    .filter((x) => x.s >= 1.5)
    .sort((a, b) => b.s - a.s);
  if (!scored.length) return undefined;
  const mine = proposed ? scored.find((x) => x.id === proposed) : undefined;
  const chosen = mine && mine.s >= scored[0].s * 0.7 ? mine.id : scored[0].id; // keep the agent's pick when it is nearly as good
  used.set(chosen, (used.get(chosen) ?? 0) + 1);
  return chosen;
}

// Models sometimes use look-alike hyphens and dashes; plain ones read better and match searches.
export const tidy = (s: string) => s.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " ").trim();

export const HOURS_PER_LEVEL = 12; // rough effort to move one level (0-3 scale)
const DAY = 864e5;

type Week = PivotProfile["plan"]["weeks"][number];
type Task = Week["tasks"][number];

// ---------- time ----------

// Weeks between today and the deadline (rounded to the nearest week) when there is one, otherwise the stated number of weeks.
export function weeksAvailable(p: PivotProfile, today: string): number {
  const d = p.goal.deadline ? Date.parse(p.goal.deadline) : NaN;
  const weeks = Number.isFinite(d) && d > Date.parse(today) ? Math.round((d - Date.parse(today)) / (7 * DAY)) : p.goal.timelineWeeks;
  return Math.max(0, Math.min(52, Math.floor(weeks)));
}

// ---------- which skills, in what order ----------

export type Weak = { id: string; label: string; gap: number; share: number; importance: number; need: number; skill: Skill };

export function hoursDoneBySkill(p: PivotProfile): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of p.plan.weeks)
    for (const t of w.tasks)
      if (t.status === "done" && t.kind !== "milestone") for (const id of t.skillIds) m.set(id, (m.get(id) ?? 0) + t.estHours / Math.max(1, t.skillIds.length));
  return m;
}

// Skills below the bar the role asks for: missing, transferable, or have-but-not-yet-strong.
export function weakSkills(p: PivotProfile): Weak[] {
  const spent = hoursDoneBySkill(p);
  const out: Weak[] = [];
  for (const s of p.skills) {
    const req = p.targetRole.requirements.find((r) => r.skillId === s.id);
    if (!req) continue;
    const gap = Math.max(0, s.required - s.current);
    if (!gap) continue;
    const need = Math.max(0, gap * HOURS_PER_LEVEL - (spent.get(s.id) ?? 0));
    if (need <= 0) continue;
    out.push({ id: s.id, label: s.label, gap, share: req.frequency, importance: req.importance, need, skill: s });
  }
  return out;
}

// Remove edges to unknown skills, self edges, and any edge that would close a cycle.
export function sanitizeDeps(raw: Record<string, string[]>, ids: string[]): Record<string, string[]> {
  const known = new Set(ids);
  const deps: Record<string, string[]> = {};
  for (const id of ids) deps[id] = [...new Set((raw[id] ?? []).filter((d) => known.has(d) && d !== id))];
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const d of [...deps[id]]) {
      if (state.get(d) === 1) deps[id] = deps[id].filter((x) => x !== d); // back edge: drop it
      else if (!state.get(d)) visit(d);
    }
    state.set(id, 2);
  };
  for (const id of ids) if (!state.get(id)) visit(id);
  return deps;
}

// Skills asked for in more job descriptions come first; a skill never comes before its prerequisites.
export function orderSkills(weak: Weak[], deps: Record<string, string[]>): Weak[] {
  const ids = new Set(weak.map((w) => w.id));
  const priority = (w: Weak) => w.share * 100 + w.gap * 5 + w.importance;
  const left = [...weak];
  const placed = new Set<string>();
  const out: Weak[] = [];
  while (left.length) {
    let ready = left.filter((w) => (deps[w.id] ?? []).filter((d) => ids.has(d)).every((d) => placed.has(d)));
    if (!ready.length) ready = left; // cannot happen after sanitizeDeps; stay safe
    ready.sort((a, b) => priority(b) - priority(a) || a.label.localeCompare(b.label));
    const pick = ready[0];
    out.push(pick);
    placed.add(pick.id);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

// ---------- the week skeleton ----------

export type Slot = { skillId: string; hours: number };
export type SkeletonWeek = {
  n: number;
  budget: number; // hours the week may hold in total
  block: number;
  blockEnd: boolean;
  kind: "learn" | "practice" | "wrap";
  slots: Slot[]; // skill work
  milestoneHours: number; // 0 unless this week ends a block
};
export type Skeleton = { weeks: SkeletonWeek[]; uncovered: string[]; milestoneHours: number };

const half = (x: number) => Math.round(x * 2) / 2;
const floorHalf = (x: number) => Math.floor(x * 2 + 1e-9) / 2;

// Sizes of 2 or 3 weeks that add up to n.
export function blockSizes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  const count = Math.ceil(n / 3);
  const base = Math.floor(n / count);
  const extra = n - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

export function buildSkeleton(p: PivotProfile, order: Weak[], opts: { fromWeek: number; totalWeeks: number }): Skeleton {
  const H = p.goal.hoursPerWeek;
  const n = Math.max(0, opts.totalWeeks - opts.fromWeek + 1);
  const wrapN = n >= 8 ? Math.max(1, Math.round(n * 0.12)) : 0;
  const learnN = n - wrapN;
  const M = Math.max(1, half(H * 0.5)); // a project milestone takes up to half a week
  const doneInFirst = p.plan.weeks.find((w) => w.n === opts.fromWeek)?.tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.estHours, 0) ?? 0;

  const weeks: SkeletonWeek[] = [];
  let wk = opts.fromWeek;
  blockSizes(learnN).forEach((size, b) => {
    for (let i = 0; i < size; i++, wk++) {
      const blockEnd = i === size - 1;
      const room = wk === opts.fromWeek ? Math.max(0, H - doneInFirst) : H;
      weeks.push({ n: wk, budget: room, block: b + 1, blockEnd, kind: "practice", slots: [], milestoneHours: blockEnd ? Math.min(M, room) : 0 });
    }
  });
  const blocks = weeks.length ? weeks[weeks.length - 1].block : 0;
  for (let i = 0; i < wrapN; i++, wk++) weeks.push({ n: wk, budget: H, block: blocks + 1, blockEnd: i === wrapN - 1, kind: "wrap", slots: [], milestoneHours: 0 });

  // Pour the skills into the learning weeks in priority order.
  const cap = (w: SkeletonWeek) => Math.max(0, w.budget - w.milestoneHours);
  const learn = weeks.filter((w) => w.kind !== "wrap");
  const uncovered: string[] = [];
  let wi = 0;
  let left = learn.length ? cap(learn[0]) : 0;
  const totalLeft = () => floorHalf(left + learn.slice(wi + 1).reduce((s, w) => s + cap(w), 0));
  const advance = () => {
    wi++;
    left = wi < learn.length ? cap(learn[wi]) : 0;
  };

  for (const w of order) {
    let alloc = floorHalf(w.need);
    const room = totalLeft();
    if (alloc > room) alloc = room; // the last skill that fits may get only part of what it needs
    if (alloc < Math.min(4, floorHalf(w.need)) || alloc <= 0) {
      uncovered.push(w.id);
      continue;
    }
    if (wi < learn.length && learn[wi].slots.length >= 3) advance(); // at most three skills in a week
    while (alloc > 0 && wi < learn.length) {
      if (left < 0.5) {
        advance();
        continue;
      }
      const take = Math.min(alloc, floorHalf(left));
      const slot = learn[wi].slots.find((s) => s.skillId === w.id);
      if (slot) slot.hours = half(slot.hours + take);
      else learn[wi].slots.push({ skillId: w.id, hours: half(take) });
      alloc = half(alloc - take);
      left = half(left - take);
    }
  }
  for (const w of learn) if (w.slots.length) w.kind = "learn";
  return { weeks, uncovered, milestoneHours: M };
}

// ---------- project milestones ----------

export type PlannedMilestone = { projectId: string; idx: number; title: string; hours: number; week: number };

// Projects whose skills are learned first go first. Each block end gets exactly one milestone; extra
// block ends become a checkpoint on the last project, and too many milestones are trimmed evenly.
export function scheduleMilestones(sk: Skeleton, projects: PivotProfile["projects"]): PlannedMilestone[] {
  const ends = sk.weeks.filter((w) => w.blockEnd && w.kind !== "wrap");
  if (!ends.length) return [];
  const firstWeekOf = (pr: PivotProfile["projects"][number]) =>
    Math.min(...pr.skillIds.map((id) => sk.weeks.find((w) => w.slots.some((s) => s.skillId === id))?.n ?? Infinity), Infinity);
  const ordered = [...projects].filter((pr) => pr.milestones.some((m) => !m.done)).sort((a, b) => firstWeekOf(a) - firstWeekOf(b));
  if (!ordered.length) return ends.map((w, i) => ({ projectId: "", idx: -1, title: `Portfolio checkpoint ${i + 1}`, hours: sk.milestoneHours, week: w.n }));

  const queues = ordered.map((pr) => pr.milestones.map((m, idx) => ({ projectId: pr.id, idx, title: m.title, hours: sk.milestoneHours })).filter((_, idx) => !pr.milestones[idx].done));
  let total = queues.reduce((s, q) => s + q.length, 0);
  while (total > ends.length) {
    const longest = queues.reduce((a, b) => (b.length > a.length ? b : a));
    if (longest.length <= 1) break;
    longest.pop(); // drop the last milestone of the biggest project
    total--;
  }
  const flat = queues.flat().slice(0, ends.length);
  const out: PlannedMilestone[] = flat.map((m, i) => ({ ...m, week: ends[i].n }));
  const last = ordered[ordered.length - 1];
  for (let i = flat.length; i < ends.length; i++)
    out.push({ projectId: last.id, idx: -1, title: `Checkpoint: review and polish "${last.title}"`, hours: sk.milestoneHours, week: ends[i].n });
  return out;
}

// ---------- turning agent output into plan weeks ----------

export type AgentWeek = {
  n: number;
  theme: string;
  tasks: { title: string; slot: string; hours: number; resourceId?: string | null }[];
};

export function assembleWeeks(
  p: PivotProfile,
  sk: Skeleton,
  milestones: PlannedMilestone[],
  agent: AgentWeek[],
  revision: number,
): Week[] {
  const H = p.goal.hoursPerWeek;
  const label = (id: string) => p.skills.find((s) => s.id === id)?.label ?? id;
  const wording = (id: string) => p.skills.find((s) => s.id === id)?.targetWording ?? p.targetRole.requirements.find((r) => r.skillId === id)?.targetWording;
  const suffix = revision > 0 ? `r${revision + 1}` : "";
  const usedResources = new Map<string, number>();

  return sk.weeks.map((sw) => {
    const aw = agent.find((a) => a.n === sw.n);
    const ms = milestones.find((m) => m.week === sw.n);
    const keys = new Set<string>([...sw.slots.map((s) => s.skillId), ...(ms ? ["milestone"] : []), ...(sw.kind === "wrap" ? ["wrap"] : []), ...(sw.kind === "practice" && !ms ? ["practice"] : [])]);
    const raw = (aw?.tasks ?? []).filter((t) => keys.has(t.slot));
    const tasks: Omit<Task, "id">[] = [];

    for (const key of keys) {
      const mine = raw.filter((t) => t.slot === key);
      const budget = key === "milestone" ? Math.min(sw.milestoneHours, ms?.hours ?? sw.milestoneHours) : key === "wrap" || key === "practice" ? sw.budget : (sw.slots.find((s) => s.skillId === key)?.hours ?? 0);
      const base = (t: { title: string; hours: number; resourceId?: string | null }): Omit<Task, "id"> => {
        const isSkill = key !== "milestone" && key !== "wrap" && key !== "practice";
        const resId = isSkill ? pickResource(t.resourceId, t.title, usedResources, label(key)) : undefined;
        const res = resourceById(resId);
        return {
          title: tidy(t.title),
          skillIds: key === "milestone" ? (p.projects.find((x) => x.id === ms?.projectId)?.skillIds ?? []).slice(0, 3) : isSkill ? [key] : [],
          estHours: Math.max(0.5, half(t.hours)),
          resourceId: res?.id,
          noResource: isSkill && !res ? true : undefined,
          kind: key === "milestone" ? "milestone" : key === "wrap" ? "wrap" : "learn",
          projectId: key === "milestone" && ms?.projectId ? ms.projectId : undefined,
          milestoneIdx: key === "milestone" && ms && ms.idx >= 0 ? ms.idx : undefined,
          status: "todo",
        };
      };
      let list = mine.length
        ? mine.map(base)
        : [
            base({
              hours: budget,
              title:
                key === "milestone"
                  ? (ms?.title ?? "Project milestone")
                  : key === "wrap"
                    ? "Practise interviews and send applications"
                    : key === "practice"
                      ? "Revisit this block's skills with a small practice exercise"
                      : `Work on ${label(key)}${wording(key) ? `: ${wording(key)}` : ""}`,
            }),
          ];
      // scale this slot to its budget (never above it)
      const sum = list.reduce((s, t) => s + t.estHours, 0);
      if (budget > 0 && sum > budget + 0.01) list = list.map((t) => ({ ...t, estHours: Math.max(0.5, floorHalf((t.estHours * budget) / sum)) }));
      tasks.push(...list);
    }

    // order: skill work first (in skeleton order), then milestone
    const rank = (t: Omit<Task, "id">) => (t.kind === "milestone" ? 2 : t.kind === "wrap" ? 1 : 0);
    tasks.sort((a, b) => rank(a) - rank(b));
    // final guard: the week can never exceed the hours the person has
    let total = tasks.reduce((s, t) => s + t.estHours, 0);
    for (let i = tasks.length - 1; total > H + 0.01 && i >= 0; i--) {
      const cut = Math.min(tasks[i].estHours - 0.5, total - H);
      if (cut > 0) {
        tasks[i].estHours = half(tasks[i].estHours - Math.ceil(cut * 2) / 2);
        total = tasks.reduce((s, t) => s + t.estHours, 0);
      }
    }

    const theme = tidy(aw?.theme ?? "") || (sw.kind === "wrap" ? "Interviews and applications" : sw.slots[0] ? label(sw.slots[0].skillId) : (ms?.title ?? "Practice"));
    const kept = p.plan.weeks.find((w) => w.n === sw.n)?.tasks.filter((t) => t.status === "done") ?? [];
    const all = [...kept, ...tasks.map((t, i) => ({ ...t, id: `w${sw.n}t${kept.length + i + 1}${suffix}` }))];
    return {
      n: sw.n,
      theme,
      hours: half(all.reduce((s, t) => s + t.estHours, 0)),
      tasks: all,
      block: sw.block,
      blockEnd: sw.blockEnd,
      wrap: sw.kind === "wrap" || undefined,
    };
  });
}
