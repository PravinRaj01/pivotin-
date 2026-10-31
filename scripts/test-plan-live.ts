// npm run test:plan-live   (live model calls, about 5 requests)
// Builds a whole plan for a DIFFERENT field than the demo persona: Hannah, a teacher moving to UX design,
// with 10 hours a week and about 13 weeks. Checks the guarantees on what the models really wrote.
import { join } from "node:path";
import { buildPlan, type Call } from "../lib/plan-run";
import { RESOURCES, resourceById } from "../lib/planner";
import { teacher } from "../lib/seeds/teacher";

process.loadEnvFile(join(__dirname, "..", ".env.local"));

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const call: Call = async (route, input) => {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(input) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
};

(async () => {
  const p0 = structuredClone(teacher);
  p0.plan = { generatedAt: "", revision: 0, weeks: [], uncovered: [], changelog: [] };
  p0.projects = [];
  p0.skills = p0.skills.map((s) => ({ ...s, dependsOn: undefined }));

  console.log("Teacher to UX designer, 10 hours a week, deadline 31 Jan 2027, from 31 Oct 2026");
  const p = await buildPlan(p0, { reason: "First plan", today: "2026-10-31", call, onStep: (s) => console.log(`   ${String(s.pct).padStart(3)}% ${s.label}`) });
  const weeks = p.plan.weeks;
  const tasks = weeks.flatMap((w) => w.tasks);
  const H = p.goal.hoursPerWeek;

  console.log("\nTime");
  check("one entry per week up to the deadline (13)", weeks.length === 13, weeks.length);
  check("no week holds more than 10 hours", weeks.every((w) => sum(w.tasks.map((t) => t.estHours)) <= H + 1e-9), weeks.map((w) => w.hours));
  check("every week has at least one task", weeks.every((w) => w.tasks.length > 0));

  console.log("\nOrder");
  const sk = new Map(p.skills.map((s) => [s.id, s]));
  const firstWeek = (id: string) => weeks.find((w) => w.tasks.some((t) => t.kind === "learn" && t.skillIds.includes(id)))?.n ?? Infinity;
  const planned = [...new Set(tasks.filter((t) => t.kind === "learn").flatMap((t) => t.skillIds))];
  const deps = p.skills.flatMap((s) => (s.dependsOn ?? []).filter((d) => planned.includes(d) && planned.includes(s.id)).map((d) => [d, s.id] as const));
  console.log(`   prerequisites the agent found: ${deps.map(([a, b]) => `${sk.get(a)!.label} before ${sk.get(b)!.label}`).join("; ") || "none"}`);
  check("no skill starts before its prerequisite", deps.every(([pre, s]) => firstWeek(pre) <= firstWeek(s)), deps.map(([a, b]) => [firstWeek(a), firstWeek(b)]));
  const share = (id: string) => p.targetRole.requirements.find((r) => r.skillId === id)?.frequency ?? 0;
  const independent = planned.filter((id) => !deps.some(([, s]) => s === id) && !deps.some(([pre]) => pre === id));
  check("skills no one depends on start in order of how many job descriptions ask for them", independent.every((id, i) => i === 0 || share(independent[i - 1]) >= share(id) - 1e-9 || firstWeek(independent[i - 1]) <= firstWeek(id)), independent.map((id) => [sk.get(id)!.label, share(id), firstWeek(id)]));

  console.log("\nBlocks and project milestones");
  const learning = weeks.filter((w) => !w.wrap);
  const blocks = new Map<number, number>();
  for (const w of learning) blocks.set(w.block!, (blocks.get(w.block!) ?? 0) + 1);
  check("every block is 2 or 3 weeks", [...blocks.values()].every((n) => n === 2 || n === 3), [...blocks.values()]);
  check("every block ends with a project milestone task", learning.filter((w) => w.blockEnd).every((w) => w.tasks.some((t) => t.kind === "milestone")));
  check("there are 2 or 3 projects", p.projects.length >= 2 && p.projects.length <= 3, p.projects.map((x) => x.title));
  check("each project closes 2 or 3 named gaps", p.projects.every((x) => x.skillIds.length >= 2 && x.skillIds.length <= 3 && x.skillIds.every((id) => sk.has(id))), p.projects.map((x) => x.skillIds));
  check("each project says how it uses her old field (teaching)", p.projects.every((x) => x.oldFieldAngle.length > 20), p.projects.map((x) => x.oldFieldAngle));
  check("each interview story leaves the result as a blank to fill in", p.projects.every((x) => /\[[^\]]+\]/.test(x.interviewStory)), p.projects.map((x) => x.interviewStory.slice(-60)));
  check("milestones are scheduled in weeks that exist", p.projects.every((x) => x.milestones.every((m) => m.week === undefined || weeks.some((w) => w.n === m.week))));

  console.log("\nLearning resources");
  const learn = tasks.filter((t) => t.kind === "learn");
  check("every link is a resource from the curated list", learn.every((t) => !t.resourceId || RESOURCES.some((r) => r.id === t.resourceId)));
  check("a task never has both a link and a no-resource flag", learn.every((t) => !(t.resourceId && t.noResource)));
  check("a task with no link says so", learn.filter((t) => !t.resourceId).every((t) => t.noResource === true));
  check("at least half of the skill tasks found a relevant curated link", learn.filter((t) => t.resourceId).length >= learn.length / 2, `${learn.filter((t) => t.resourceId).length} of ${learn.length}`);
  const linked = learn.filter((t) => t.resourceId).slice(0, 8);
  for (const t of linked) console.log(`   ~ "${t.title.slice(0, 60)}" -> ${resourceById(t.resourceId)!.title}`);
  const none = learn.filter((t) => t.noResource);
  for (const t of none.slice(0, 4)) console.log(`   ~ no curated resource: "${t.title.slice(0, 70)}" (${t.skillIds.map((i) => sk.get(i)?.label).join(", ")})`);

  console.log(`\nCovered ${planned.length} skills; not in plan: ${p.plan.uncovered.length}`);
  console.log(`Summary: ${p.plan.changelog[0].summary}`);
  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall live plan tests passed");
  process.exit(fails.length ? 1 : 0);
})();
