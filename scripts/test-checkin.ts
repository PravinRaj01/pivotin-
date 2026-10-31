// npm run test:checkin   (offline, no model calls)
// What a check-in does to the plan: ticking and logging, then the re-plan. The promises: the hours always fit,
// order and project milestones survive, nothing disappears silently, and the choices offered are real.
import { applyCheckin, candidateTasks, checkinInput, checkinWeek, exampleWeek } from "../lib/checkin";
import { currentWeek, planProgress } from "../lib/plan";
import { analyze, applyReplan, diffPlans, reflow } from "../lib/replan";
import { arjun } from "../lib/seeds/arjun";
import type { PivotProfile } from "../lib/types";

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const NOW = "2026-11-08T10:00:00.000Z";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const baseId = (id: string) => id.replace(/c\d+$/, "");
const tasksOf = (p: PivotProfile, n: number) => p.plan.weeks.find((w) => w.n === n)!.tasks;

const p0 = arjun;
const W = checkinWeek(p0);
const wk = tasksOf(p0, W);
const learn = wk.find((t) => t.kind === "learn")!;
const ms = wk.find((t) => t.kind === "milestone")!;
const H = p0.goal.hoursPerWeek;

console.log(`\nSetup: Arjun is on week ${W} of ${p0.plan.weeks.length}, ${H} hours a week`);
check("the check-in is for the week he is on", W === currentWeek(p0) && W === 6, W);
check("the week has a learning task and a project milestone", !!learn && !!ms);

console.log("\nTicking and logging");
const r = { hoursSpent: 5.3, completedTaskIds: [learn.id, "not-a-task"], skippedTaskIds: [ms.id, learn.id], blockers: ["release crunch ", ""], mood: 2.4, wins: ["roadmap skeleton"], notes: "", hoursPerWeekFromNow: 0, coachMessage: "Good that you shipped the skeleton." };
const { profile: p1, record } = applyCheckin(p0, W, r, "I did the roadmap skeleton...", NOW, "c-test");
const st = (id: string) => tasksOf(p1, W).find((t) => t.id === id)!.status;
check("the finished task is ticked", st(learn.id) === "done");
check("a task named in both lists counts as finished, not skipped", !record.parsed.skippedTaskIds.includes(learn.id) && record.parsed.completedTaskIds.includes(learn.id));
check("the skipped task is marked skipped", st(ms.id) === "skipped", st(ms.id));
check("an id that is not in the plan is ignored", !record.parsed.completedTaskIds.includes("not-a-task"));
check("hours are logged to the nearest half hour", record.parsed.hoursSpent === 5.5, record.parsed.hoursSpent);
check("the week's planned hours are stored next to the logged hours", record.parsed.plannedHours === p0.plan.weeks.find((w) => w.n === W)!.hours);
check("blockers are tidied and mood is a whole number 1 to 5", record.parsed.blockers.length === 1 && record.parsed.mood === 2, [record.parsed.blockers, record.parsed.mood]);
check("the check-in is saved on the profile once", p1.checkins.filter((c) => c.id === "c-test").length === 1 && applyCheckin(p1, W, r, "again", NOW, "c-test").profile.checkins.filter((c) => c.id === "c-test").length === 1);
check("a hugely wrong hours figure is capped", applyCheckin(p0, W, { ...r, hoursSpent: 400 }, "x", NOW).record.parsed.hoursSpent === 80);
check("ticking a project milestone task also ticks the project", applyCheckin(p0, W, { ...r, completedTaskIds: [ms.id], skippedTaskIds: [] }, "x", NOW).profile.projects.find((x) => x.id === ms.projectId)!.milestones[ms.milestoneIdx!].done === true);
check("a task that is already done cannot be 'finished' again", applyCheckin(p1, W, { ...r, completedTaskIds: [learn.id] }, "x", NOW).record.parsed.completedTaskIds.length === 0);
check("the agent's input lists this week's tasks with their status", checkinInput(p0, W, "x").week.tasks.length === wk.length && checkinInput(p0, W, "x").week.tasks.every((t) => t.id && t.status));
check("candidate tasks include this week's and older unfinished ones only", candidateTasks(p0, W).every((t) => t.status !== "done" || wk.some((x) => x.id === t.id)));
check("the example week is built from this week's own tasks", exampleWeek(p0, W).toLowerCase().includes(learn.title.slice(0, 12).toLowerCase()), exampleWeek(p0, W).slice(0, 80));

console.log("\nBehind or not");
const doneAll = applyCheckin(p0, W, { ...r, completedTaskIds: wk.map((t) => t.id), skippedTaskIds: [] }, "x", NOW).profile;
const a0 = analyze(doneAll, W);
check("finishing everything is not behind", !a0.behind && a0.base.dropped.length === 0, a0.base.droppedHours);
check("and the weeks ahead are left exactly as they were", a0.base.unchanged && JSON.stringify(a0.base.weeks) === JSON.stringify(doneAll.plan.weeks.filter((w) => w.n > W)));
check("so the before-and-after has nothing to show", diffPlans(doneAll.plan.weeks, applyReplan(doneAll, a0.base, "s", "r", NOW).plan.weeks).weeks.length === 0);

const a1 = analyze(p1, W);
console.log(`   skipped the 4h milestone: needs ${a1.base.needHours}h, room ${a1.base.capacityHours}h, ${a1.base.droppedHours}h do not fit, behind=${a1.behind}`);
check("the analysis counts the unfinished hours from this week", a1.unfinishedHours === ms.estHours, a1.unfinishedHours);

// a worse week: three whole weeks of lost work so the plan is clearly behind
let bad = p0;
for (const w of [4, 5, 6]) for (const t of tasksOf(bad, w)) bad = { ...bad, plan: { ...bad.plan, weeks: bad.plan.weeks.map((x) => (x.n === w ? { ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, status: "skipped" as const } : y)) } : x)) } };
const bad6 = analyze(bad, 6);
check("with weeks of work skipped the plan is behind", bad6.behind && bad6.base.droppedHours > 0, [bad6.base.droppedHours, bad6.unfinishedHours]);

console.log("\nEvery option keeps its promises");
const rfs = [
  ["no change", bad6.base],
  ["push the deadline", bad6.push!.reflow],
  ...bad6.drops.map((d) => [`drop ${d.label}`, d.reflow] as const),
] as const;
for (const [name, rf] of rfs) {
  const applied = applyReplan(bad, rf, "s", "r", NOW);
  const ahead = applied.plan.weeks.filter((w) => w.n >= 7);
  check(`${name}: no week holds more than ${H} hours`, ahead.every((w) => sum(w.tasks.filter((t) => t.status !== "moved" && t.status !== "skipped").map((t) => t.estHours)) <= H + 1e-9), ahead.map((w) => w.hours).filter((h) => h > H));
  check(`${name}: task ids stay unique`, new Set(applied.plan.weeks.flatMap((w) => w.tasks.map((t) => t.id))).size === applied.plan.weeks.flatMap((w) => w.tasks).length);
  check(`${name}: finished work is never touched`, bad.plan.weeks.flatMap((w) => w.tasks).filter((t) => t.status === "done").every((t) => applied.plan.weeks.flatMap((w) => w.tasks).some((x) => x.id === t.id && x.status === "done")));
  const stillTodo = new Set(applied.plan.weeks.flatMap((w) => w.tasks).filter((t) => t.status === "todo").map((t) => baseId(t.id)));
  const lost = bad.plan.weeks.flatMap((w) => w.tasks).filter((t) => (t.status === "todo" || t.status === "skipped") && !(t.kind === "milestone" && t.milestoneIdx === undefined) && !stillTodo.has(baseId(t.id)));
  check(`${name}: every unfinished task is scheduled or listed as dropped, none vanishes`, lost.every((t) => rf.dropped.some((d) => d.id === t.id)) && lost.length === rf.dropped.length, [lost.length, rf.dropped.length]);
  const lw = ahead.filter((w) => !w.wrap && w.block !== undefined);
  check(`${name}: every block of weeks ahead ends with a project milestone`, lw.filter((w) => w.blockEnd).every((w) => w.tasks.some((t) => t.kind === "milestone")), lw.filter((w) => w.blockEnd && !w.tasks.some((t) => t.kind === "milestone")).map((w) => w.n));
  const blockLen = new Map<number, number>();
  for (const w of lw) blockLen.set(w.block!, (blockLen.get(w.block!) ?? 0) + 1);
  check(`${name}: blocks are 2 or 3 weeks`, [...blockLen.values()].every((n) => n === 2 || n === 3), [...blockLen.values()]);
  const rankFirst = new Map<string, number>();
  for (const w of p0.plan.weeks) for (const t of w.tasks) if (t.kind === "learn" && t.skillIds[0] && !rankFirst.has(t.skillIds[0])) rankFirst.set(t.skillIds[0], w.n);
  const seq = ahead.flatMap((w) => w.tasks.filter((t) => t.kind === "learn" && t.status === "todo" && t.skillIds[0]).map((t) => ({ w: w.n, r: rankFirst.get(t.skillIds[0]) ?? 999 })));
  check(`${name}: skills still go in their original order`, seq.every((x, i) => i === 0 || x.r >= seq[i - 1].r || seq[i - 1].w === x.w), seq.filter((x, i) => i > 0 && x.r < seq[i - 1].r && seq[i - 1].w !== x.w).slice(0, 3));
}

console.log("\nWhat gets dropped");
const natural = bad6.base;
const placedRanks = natural.weeks.flatMap((w) => w.tasks).filter((t) => t.kind === "learn" && t.status === "todo" && t.skillIds[0]);
const rank = new Map<string, number>();
for (const w of p0.plan.weeks) for (const t of w.tasks) if (t.kind === "learn" && t.skillIds[0] && !rank.has(t.skillIds[0])) rank.set(t.skillIds[0], w.n);
const rk = (id: string) => rank.get(id) ?? 999;
check("what is dropped ranks below everything that was kept", natural.dropped.filter((t) => t.kind === "learn").every((d) => placedRanks.every((k) => rk(k.skillIds[0]) <= rk(d.skillIds[0]))), natural.droppedSkillIds);
check("the drop options list the lowest-priority topics first", bad6.drops.length > 0 && bad6.drops.every((d, i) => i === 0 || rk(d.skillId) <= rk(bad6.drops[i - 1].skillId)), bad6.drops.map((d) => d.label));
const first = bad6.drops[0];
check("choosing a topic to drop removes all of that topic's unfinished tasks", first.reflow.dropped.filter((t) => t.skillIds[0] === first.skillId).length === first.tasks, [first.reflow.dropped.length, first.tasks]);
check("dropping a topic frees hours so less else is lost", first.reflow.droppedHours - first.hours <= natural.droppedHours + 1e-9, [first.reflow.droppedHours, first.hours, natural.droppedHours]);

console.log("\nPushing the deadline");
const push = bad6.push!;
check("push adds the fewest weeks that make everything fit", push.fits && push.reflow.droppedHours <= 0.01 && (push.weeks === 1 || reflow(bad, { fromWeek: 7, extraWeeks: push.weeks - 1 }).droppedHours > 0.01), push.weeks);
const pushed = applyReplan(bad, push.reflow, "s", "r", NOW);
check("the plan grows by exactly that many weeks", pushed.plan.weeks.length === bad.plan.weeks.length + push.weeks, pushed.plan.weeks.length);
check("the deadline moves by a week for each week added", pushed.goal.deadline === push.deadline && Date.parse(pushed.goal.deadline!) - Date.parse(bad.goal.deadline!) === push.weeks * 7 * 864e5, [bad.goal.deadline, pushed.goal.deadline]);
check("the stated number of weeks grows too", pushed.goal.timelineWeeks === bad.goal.timelineWeeks + push.weeks);
check("nothing is dropped by pushing", pushed.plan.weeks.flatMap((w) => w.tasks).every((t) => t.status !== "skipped" || bad.plan.weeks.flatMap((x) => x.tasks).some((x) => x.id === t.id)));

console.log("\nApplying a choice");
check("carried tasks are marked 'moved' with the week they went to", pushed.plan.weeks.filter((w) => w.n < 7).flatMap((w) => w.tasks).filter((t) => t.status === "moved").every((t) => t.movedTo && t.movedTo >= 7) && pushed.plan.weeks.some((w) => w.tasks.some((t) => t.status === "moved")));
check("each carried task appears as a copy that says where it came from", pushed.plan.weeks.flatMap((w) => w.tasks).filter((t) => t.carriedFrom).every((t) => t.carriedFrom! < 7) && pushed.plan.weeks.flatMap((w) => w.tasks).some((t) => t.carriedFrom));
check("the revision goes up and the change is logged", pushed.plan.revision === bad.plan.revision + 1 && pushed.plan.changelog[0].reason === "r");
const dropped = applyReplan(bad, first.reflow, "s", "r", NOW);
check("dropped tasks are gone from the weeks ahead", dropped.plan.weeks.filter((w) => w.n >= 7).flatMap((w) => w.tasks).every((t) => baseId(t.id) !== "" && !first.reflow.dropped.some((d) => d.id === t.id)));
check("the topic that was dropped no longer has work scheduled", !dropped.plan.weeks.filter((w) => w.n >= 7).flatMap((w) => w.tasks).some((t) => t.kind === "learn" && t.skillIds[0] === first.skillId && t.status === "todo"));
check("a topic with nothing left is listed as not in the plan", first.reflow.droppedSkillIds.includes(first.skillId) && (dropped.plan.uncovered.includes(first.skillId) || dropped.plan.weeks.some((w) => w.tasks.some((t) => t.skillIds[0] === first.skillId && t.status === "todo"))));
check("project milestones get their new weeks", dropped.projects.every((pr) => pr.milestones.every((m) => m.done || m.week === undefined || m.week >= 7)));

console.log("\nHours that change for good");
const less = analyze(bad, 6, 5);
check("fewer hours a week means more does not fit", less.base.droppedHours >= bad6.base.droppedHours, [less.base.droppedHours, bad6.base.droppedHours]);
const lessApplied = applyReplan(bad, less.base, "s", "r", NOW);
check("the new weekly hours are saved on the goal and respected", lessApplied.goal.hoursPerWeek === 5 && lessApplied.plan.weeks.filter((w) => w.n >= 7).every((w) => sum(w.tasks.filter((t) => t.status === "todo" || t.status === "done").map((t) => t.estHours)) <= 5 + 1e-9));

console.log("\nBefore and after");
const diff = diffPlans(bad.plan.weeks, pushed.plan.weeks);
check("pushing the deadline never reports a dropped task", diff.dropped === 0, diff.dropped);
check("a placeholder checkpoint is never reported as dropped or moved", !diff.weeks.some((w) => [...w.before, ...w.after].some((i) => i.task.kind === "milestone" && i.task.milestoneIdx === undefined)));
check("the diff shows carried work and new weeks for a pushed deadline", diff.carried >= 1 && diff.newWeeks === push.weeks, [diff.carried, diff.newWeeks]);
const dd = diffPlans(bad.plan.weeks, dropped.plan.weeks);
check("the diff shows dropped tasks when a topic is dropped", dd.dropped >= first.tasks, [dd.dropped, first.tasks]);
check("only weeks that changed are listed", diff.weeks.every((w) => w.before.some((i) => i.change !== "same") || w.after.some((i) => i.change !== "same")));
check("a carried task is counted once: where it now sits, not where it was", planProgress(pushed).total === pushed.plan.weeks.flatMap((w) => w.tasks).filter((x) => x.status !== "moved").length && pushed.plan.weeks.flatMap((w) => w.tasks).some((x) => x.status === "moved"));

console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall check-in tests passed");
process.exit(fails.length ? 1 : 0);
