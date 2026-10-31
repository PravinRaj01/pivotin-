// npm run test:plan   (offline, no model calls)
// The guarantees the planner makes no matter what an agent writes: skill order, hours that fit, a project
// milestone ending every block of 2 or 3 weeks, links that exist, and honest "no resource" flags.
import { toggleMilestone, toggleTask } from "../lib/plan";
import {
  RESOURCES,
  assembleWeeks,
  blockSizes,
  buildSkeleton,
  orderSkills,
  resourceById,
  sanitizeDeps,
  scheduleMilestones,
  weakSkills,
  weeksAvailable,
  type AgentWeek,
} from "../lib/planner";
import { shapeProjects } from "../lib/plan-run";
import { pickResource, relevance, tidy } from "../lib/planner";
import { arjun } from "../lib/seeds/arjun";

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const TODAY = "2026-10-31";
const p = structuredClone(arjun);
p.plan = { generatedAt: "", revision: 0, weeks: [], uncovered: [], changelog: [] };

console.log("\nResource list");
check("every id is unique", new Set(RESOURCES.map((r) => r.id)).size === RESOURCES.length);
check("every link is https with a title and topics", RESOURCES.every((r) => r.url.startsWith("https://") && r.title && r.topics.length > 0));
check("an unknown id finds nothing", resourceById("made-up-id") === undefined);

console.log("\nIs a link really about the task?");
const fresh = () => new Map<string, number>();
check("a resource about the task's topic is accepted", pickResource("intercom-rice", "Prioritize features using RICE scoring", fresh()) === "intercom-rice");
check("a mismatched pick is replaced by the right curated resource", pickResource("atlassian-agile", "Map the user journey and find friction points", fresh()) === "nng-journey", pickResource("atlassian-agile", "Map the user journey and find friction points", fresh()));
check("a task nothing in the list covers gets no link", pickResource("atlassian-agile", "Map key stakeholder groups and their goals Stakeholder collaboration", fresh()) === undefined, pickResource("atlassian-agile", "Map key stakeholder groups and their goals Stakeholder collaboration", fresh()));
check("an invented id is never returned", pickResource("made-up-id", "Learn SQL joins", fresh()) !== "made-up-id");
const reuse = fresh();
const picks = [1, 2, 3].map(() => pickResource("sqlbolt", "Practise SQL joins and queries", reuse));
check("one resource is not used for more than two tasks", picks.filter((x) => x === "sqlbolt").length <= 2, picks);
check("words found in many resources do not count as a match", relevance("atlassian-agile", "product data design") === 0, relevance("atlassian-agile", "product data design"));
check("generic title words do not make a match (\"simple\", \"interactive\")", pickResource("intercom-rice", "Build a simple UI component library with 10 interactive buttons", fresh()) !== "intercom-rice" && pickResource("sqlbolt", "Build interactive prototype flows", fresh()) !== "sqlbolt");
check("interactive prototype work finds the design-tool resource, not a SQL one", pickResource("sqlbolt", "Build smart animations and interactive prototype flows in Figma", fresh()) === "figma-help", pickResource("sqlbolt", "Build smart animations and interactive prototype flows in Figma", fresh()));
check("accessibility contrast work finds an accessibility resource", /w3c-wai|wcag-quickref/.test(pickResource("evanmiller-ab", "Document accessibility contrast ratios and touch target sizes", fresh()) ?? ""), pickResource("evanmiller-ab", "Document accessibility contrast ratios and touch target sizes", fresh()));
check("look-alike hyphens are normalised", tidy("Cross‑Team  plan") === "Cross-Team plan", tidy("Cross‑Team  plan"));

console.log("\nTime and weak skills");
check("26 weeks from 31 Oct 2026 to 30 Apr 2027", weeksAvailable(p, TODAY) === 26, weeksAvailable(p, TODAY));
check("a deadline 13 weeks out gives 13 weeks", weeksAvailable({ ...p, goal: { ...p.goal, deadline: "2027-01-30" } }, TODAY) === 13, weeksAvailable({ ...p, goal: { ...p.goal, deadline: "2027-01-30" } }, TODAY));
check("a past deadline falls back to the stated weeks", weeksAvailable({ ...p, goal: { ...p.goal, deadline: "2026-01-01" } }, TODAY) === p.goal.timelineWeeks);
const weak = weakSkills(p);
check("only skills below the bar are weak", weak.every((w) => w.skill.current < w.skill.required) && weak.length > 0, weak.length);
check("skills already at the bar are left out", !weak.some((w) => w.skill.current >= w.skill.required));

console.log("\nOrder: more job descriptions first, prerequisites before dependents");
const byShare = orderSkills(weak, {});
check("with no dependencies, higher share comes first", byShare.every((w, i) => i === 0 || byShare[i - 1].share * 100 + byShare[i - 1].gap * 5 + byShare[i - 1].importance >= w.share * 100 + w.gap * 5 + w.importance - 1e-9), byShare.slice(0, 4).map((w) => w.label));
const top = byShare[0], rare = [...weak].sort((a, b) => a.share - b.share)[0];
check("test setup: the rarest skill is not the top one", rare.id !== top.id);
const withDep = orderSkills(weak, { [top.id]: [rare.id] });
check("a rare prerequisite is pulled ahead of the common skill that needs it", withDep.findIndex((w) => w.id === rare.id) < withDep.findIndex((w) => w.id === top.id), withDep.slice(0, 3).map((w) => w.label));
const cyc = sanitizeDeps({ a: ["b", "ghost", "a"], b: ["c"], c: ["a"] }, ["a", "b", "c"]);
check("self, unknown and looping dependencies are removed", !cyc.a.includes("a") && !cyc.a.includes("ghost") && !(cyc.a.includes("b") && cyc.b.includes("c") && cyc.c.includes("a")), cyc);
const looped = orderSkills(weak.slice(0, 3), sanitizeDeps({ [weak[0].id]: [weak[1].id], [weak[1].id]: [weak[0].id] }, weak.map((w) => w.id)));
check("a looping dependency cannot stop the plan being built", looped.length === 3);

console.log("\nBlocks of 2 or 3 weeks");
for (const n of [4, 5, 7, 10, 23, 31]) check(`${n} weeks split into blocks of 2 or 3 that add up`, blockSizes(n).every((s) => s === 2 || s === 3) && sum(blockSizes(n)) === n, blockSizes(n));

console.log("\nSkeleton for Arjun: 26 weeks, 8 hours a week");
const order = orderSkills(weak, {});
const sk = buildSkeleton(p, order, { fromWeek: 1, totalWeeks: 26 });
const H = p.goal.hoursPerWeek;
check("26 weeks", sk.weeks.length === 26, sk.weeks.length);
check("no week holds more than 8 hours (skill work plus milestone)", sk.weeks.every((w) => sum(w.slots.map((s) => s.hours)) + w.milestoneHours <= H + 1e-9), sk.weeks.map((w) => sum(w.slots.map((s) => s.hours)) + w.milestoneHours).filter((x) => x > H));
check("the learning weeks are full, so the hours are used", sk.weeks.filter((w) => w.kind === "learn" && !w.blockEnd).every((w) => sum(w.slots.map((s) => s.hours)) >= H - 1), sk.weeks.filter((w) => w.kind === "learn" && !w.blockEnd).map((w) => sum(w.slots.map((s) => s.hours))));
const learning = sk.weeks.filter((w) => w.kind !== "wrap");
const sizes: number[] = [];
for (const b of new Set(learning.map((w) => w.block))) sizes.push(learning.filter((w) => w.block === b).length);
check("every block is 2 or 3 weeks", sizes.every((s) => s === 2 || s === 3), sizes);
check("every block ends in a week with milestone hours", learning.filter((w) => w.blockEnd).length === sizes.length && learning.filter((w) => w.blockEnd).every((w) => w.milestoneHours > 0));
check("the last weeks are wrap-up weeks", sk.weeks.slice(-3).every((w) => w.kind === "wrap"), sk.weeks.slice(-4).map((w) => w.kind));
check("at most three skills in any week", sk.weeks.every((w) => w.slots.length <= 3));
const firstWeek = (id: string) => sk.weeks.find((w) => w.slots.some((s) => s.skillId === id))?.n ?? Infinity;
const placed = order.filter((w) => !sk.uncovered.includes(w.id));
check("skills start in the order they were ranked", placed.every((w, i) => i === 0 || firstWeek(w.id) >= firstWeek(placed[i - 1].id)));
check("total skill hours never exceed what each skill needs", placed.every((w) => sum(sk.weeks.flatMap((x) => x.slots.filter((s) => s.skillId === w.id).map((s) => s.hours))) <= w.need + 0.01));
const idx = (id: string) => order.findIndex((w) => w.id === id);
const lastCovered = Math.max(...placed.map((w) => idx(w.id)));
check("everything that did not fit ranks below everything that did", sk.uncovered.length > 0 && sk.uncovered.every((id) => idx(id) > lastCovered), { uncovered: sk.uncovered.map(idx), lastCovered });
const heavy = buildSkeleton(p, order, { fromWeek: 1, totalWeeks: 60 });
check("with plenty of time everything fits", heavy.uncovered.length === 0, heavy.uncovered.length);
const tight = buildSkeleton(p, order, { fromWeek: 1, totalWeeks: 6 });
check("a short deadline drops the lowest-priority skills, not the highest", tight.uncovered.length > 0 && !tight.uncovered.includes(order[0].id));
check("re-planning from week 7 builds only weeks 7 to 26", buildSkeleton(p, order, { fromWeek: 7, totalWeeks: 26 }).weeks.map((w) => w.n).join() === Array.from({ length: 20 }, (_, i) => i + 7).join());

console.log("\nProjects and milestones");
const coveredIds = new Set(placed.map((w) => w.id));
const [a, b, c, d] = [...coveredIds];
const shaped = shapeProjects(
  { projects: [
      { title: "Ok project", pitch: "x", closesGaps: [a, b, "made-up"], oldFieldAngle: "old", interviewStory: "story [n]", deliverable: "doc", milestones: ["m1", "m2", "m3", "m4"] },
      { title: "One gap only", pitch: "x", closesGaps: [c], oldFieldAngle: "", interviewStory: "", deliverable: "", milestones: ["m1", "m2", "m3"] },
      { title: "Second ok", pitch: "x", closesGaps: [c, d, a, b], oldFieldAngle: "old", interviewStory: "s", deliverable: "doc", milestones: ["n1", "n2", "n3"] },
    ] },
  coveredIds, 8, sk.milestoneHours,
);
check("a project with fewer than 2 real gaps is dropped", shaped.length === 2 && shaped.every((x) => x.skillIds.length >= 2), shaped.map((x) => x.title));
check("made-up skill ids are removed and at most 3 gaps are kept", shaped.every((x) => x.skillIds.length <= 3 && x.skillIds.every((id) => coveredIds.has(id))));
const pp = { ...p, projects: shaped };
const ms = scheduleMilestones(sk, shaped);
const ends = learning.filter((w) => w.blockEnd);
check("exactly one milestone on every block-end week", ms.length === ends.length && ends.every((w) => ms.filter((m) => m.week === w.n).length === 1), ms.map((m) => m.week));
check("a project's real milestones are in order", shaped.every((pr) => ms.filter((m) => m.projectId === pr.id && m.idx >= 0).every((m, i, arr) => i === 0 || m.idx > arr[i - 1].idx)));
const tooMany = scheduleMilestones(buildSkeleton(p, order, { fromWeek: 1, totalWeeks: 6 }), shaped);
check("more milestones than blocks are trimmed to fit", tooMany.length === buildSkeleton(p, order, { fromWeek: 1, totalWeeks: 6 }).weeks.filter((w) => w.blockEnd && w.kind !== "wrap").length);

const hog = shapeProjects(
  { projects: [
      { title: "A", pitch: "", closesGaps: [a, b], oldFieldAngle: "o", interviewStory: "s", deliverable: "d", milestones: ["1", "2", "3", "4", "5"] },
      { title: "B", pitch: "", closesGaps: [b, c], oldFieldAngle: "o", interviewStory: "s", deliverable: "d", milestones: ["1", "2", "3"] },
    ] },
  coveredIds, 4, 5,
);
check("with only 4 milestone slots two projects still share them 2 and 2", hog.length === 2 && hog.every((x) => x.milestones.length === 2), hog.map((x) => x.milestones.length));
check("a trimmed project keeps its last milestone, the deliverable", hog[0].milestones[1].title === "5", hog[0].milestones.map((m) => m.title));
check("a story without a blank gets one added", /\[[^\]]+\]/.test(hog[0].interviewStory), hog[0].interviewStory);

console.log("\nAssembling tasks from messy agent output");
const noRes = placed.find((w) => !/sql|research|metric|experiment|specs|strategy|prioriti|communication|stakeholder|engineering|problem|ownership|go-to|ai/i.test(w.label))?.id;
const msWeek = ms[0].week;
const agent: AgentWeek[] = sk.weeks.map((w) => ({
  n: w.n,
  theme: `Week ${w.n}`,
  tasks: [
    ...w.slots.map((s) => ({ title: `Do ${s.skillId}`, slot: s.skillId, hours: s.hours + 3, resourceId: "made-up-id" as string | null })), // too many hours, invented link
    ...w.slots.slice(0, 1).map((s) => ({ title: "Practise SQL queries and joins", slot: s.skillId, hours: 1, resourceId: RESOURCES[0].id })), // a real link
    { title: "Stray task", slot: "not-a-slot", hours: 5, resourceId: null }, // not in this week
  ],
}));
const written = assembleWeeks(pp, sk, ms, agent, 0);
check("every week holds at most 8 hours however much the agent wrote", written.every((w) => w.hours <= H + 1e-9 && sum(w.tasks.map((t) => t.estHours)) <= H + 1e-9), written.map((w) => w.hours).filter((x) => x > H));
check("tasks for slots that are not in that week are discarded", !written.some((w) => w.tasks.some((t) => t.title === "Stray task")));
check("invented resource ids never reach the plan", written.every((w) => w.tasks.every((t) => !t.resourceId || !!resourceById(t.resourceId))));
check("a real resource id is kept", written.flatMap((w) => w.tasks).some((t) => t.resourceId === RESOURCES[0].id));
check("skill tasks with no valid resource say so", written.flatMap((w) => w.tasks).filter((t) => t.kind === "learn" && !t.resourceId).every((t) => t.noResource === true));
check("skill tasks that have a resource are not flagged", written.flatMap((w) => w.tasks).filter((t) => t.resourceId).every((t) => !t.noResource));
check("every slot got at least one task", sk.weeks.every((w) => w.slots.every((s) => written.find((x) => x.n === w.n)!.tasks.some((t) => t.skillIds.includes(s.skillId)))));
const msTasks = written.flatMap((w) => w.tasks).filter((t) => t.kind === "milestone");
check("a milestone task ends every block and is tied to its project", msTasks.length === ends.length && msTasks.every((t) => t.projectId === "" || shaped.some((x) => x.id === t.projectId) || t.projectId === undefined));
check("the week a milestone lands in is the end of a block", written.filter((w) => w.tasks.some((t) => t.kind === "milestone")).every((w) => w.blockEnd));
check("task ids are unique", new Set(written.flatMap((w) => w.tasks.map((t) => t.id))).size === written.flatMap((w) => w.tasks).length);
check("wrap-up weeks have tasks too", written.filter((w) => w.wrap).every((w) => w.tasks.length > 0 && w.tasks.every((t) => t.kind === "wrap")));
void noRes;

console.log("\nTicking a milestone");
const full = { ...pp, plan: { ...pp.plan, weeks: written } };
const t0 = full.plan.weeks.flatMap((w) => w.tasks).find((t) => t.kind === "milestone" && t.projectId && t.milestoneIdx !== undefined)!;
const ticked = toggleTask(full, t0.id);
const proj = ticked.projects.find((x) => x.id === t0.projectId)!;
check("ticking the plan task ticks the project milestone", proj.milestones[t0.milestoneIdx!].done === true && proj.status === "active", proj.status);
const unticked = toggleMilestone(ticked, t0.projectId!, t0.milestoneIdx!);
check("unticking it on the project unticks the plan task", unticked.plan.weeks.flatMap((w) => w.tasks).find((t) => t.id === t0.id)!.status === "todo");

console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall plan tests passed");
process.exit(fails.length ? 1 : 0);
