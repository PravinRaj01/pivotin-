// npm run test:checkin-live   (live model calls, 4 requests)
// Does the check-in agent tick the right tasks, log the hours, and pick up what got in the way?
// Includes a different field (Hannah, teacher to UX) and a week where nothing was done.
import { join } from "node:path";
import { applyCheckin, checkinInput, checkinWeek } from "../lib/checkin";
import type { CheckinResult } from "../lib/schemas/agents";
import { arjun } from "../lib/seeds/arjun";
import { teacher } from "../lib/seeds/teacher";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const NOW = "2026-11-08T10:00:00.000Z";

async function run(label: string, p: typeof arjun, transcript: string) {
  const W = checkinWeek(p);
  const mod = await import("../app/api/checkin/route");
  const res = await mod.POST(new Request("http://local/api/checkin", { method: "POST", body: JSON.stringify(checkinInput(p, W, transcript)) }));
  if (!res.ok) throw new Error(`${label}: ${res.status} ${await res.text()}`);
  const r = (await res.json()) as CheckinResult;
  const tasks = p.plan.weeks.find((w) => w.n === W)!.tasks;
  const applied = applyCheckin(p, W, r, transcript, NOW);
  console.log(`   ${label}: week ${W}, done [${applied.record.parsed.completedTaskIds.map((id) => tasks.findIndex((t) => t.id === id) + 1)}] skipped [${applied.record.parsed.skippedTaskIds.map((id) => tasks.findIndex((t) => t.id === id) + 1)}] hours ${applied.record.parsed.hoursSpent} blockers ${JSON.stringify(applied.record.parsed.blockers)} newHours ${applied.record.parsed.hoursPerWeekFromNow ?? "-"}`);
  console.log(`      coach: ${r.coachMessage}`);
  return { W, tasks, r, rec: applied.record, profile: applied.profile };
}
const idx = (x: Awaited<ReturnType<typeof run>>, ids: string[]) => ids.map((id) => x.tasks.findIndex((t) => t.id === id) + 1).sort();

(async () => {
  console.log("\n1. Arjun: a plain mixed week");
  const a = await run("mixed", arjun, "This week I finished the roadmap skeleton in the visual tool, that took me about four hours. I did not get to the milestone write-up, the draft roadmap document, because of a release crunch at work. About five hours in total.");
  check("ticks the roadmap skeleton (task 1)", idx(a, a.rec.parsed.completedTaskIds).join() === "1", idx(a, a.rec.parsed.completedTaskIds));
  check("marks the milestone write-up as skipped (task 2)", idx(a, a.rec.parsed.skippedTaskIds).join() === "2", idx(a, a.rec.parsed.skippedTaskIds));
  check("logs 5 hours", a.rec.parsed.hoursSpent === 5, a.rec.parsed.hoursSpent);
  check("picks up the release crunch as what got in the way", a.rec.parsed.blockers.some((b) => /release|crunch|work/i.test(b)), a.rec.parsed.blockers);
  check("a plain one-off bad week is not a lasting change in hours", !a.rec.parsed.hoursPerWeekFromNow, a.rec.parsed.hoursPerWeekFromNow);
  check("the coach message answers what was said", a.r.coachMessage.length > 20 && /skeleton|roadmap|crunch|release|four|five/i.test(a.r.coachMessage), a.r.coachMessage);
  check("the profile really has the task ticked and the other skipped", a.profile.plan.weeks.find((w) => w.n === a.W)!.tasks.map((t) => t.status).join() === "done,skipped", a.profile.plan.weeks.find((w) => w.n === a.W)!.tasks.map((t) => t.status));

  console.log("\n2. Arjun: rambling, a correction, a tangent, hours per day");
  const b = await run("rambling", arjun, "Okay so Tuesday I spent two hours on the roadmap skeleton, no wait, three hours, and then Thursday another hour finishing it off so that task is done. My cat knocked my laptop off the desk on Wednesday which was a whole thing, anyway. I never touched the milestone document, no time. Nothing else.");
  check("ticks the roadmap skeleton", idx(b, b.rec.parsed.completedTaskIds).join() === "1", idx(b, b.rec.parsed.completedTaskIds));
  check("uses the corrected hours: 3 + 1 = 4", b.rec.parsed.hoursSpent === 4, b.rec.parsed.hoursSpent);
  check("the milestone document is skipped", idx(b, b.rec.parsed.skippedTaskIds).join() === "2", idx(b, b.rec.parsed.skippedTaskIds));

  console.log("\n3. Hannah (teacher to UX): a different field, and a lasting change in hours");
  const h = await run("teacher", teacher, "I did the Figma basics, frames and text and components, that was the longest bit. I read two of the three job descriptions but I did not finish the third so I would not count that one as done, and I never mapped my teaching skills at all. Around five hours. Also from now on I can only manage six hours a week because I am taking over exam marking.");
  const figma = h.tasks.findIndex((t) => /figma/i.test(t.title)) + 1;
  const map = h.tasks.findIndex((t) => /map/i.test(t.title)) + 1;
  const jd = h.tasks.findIndex((t) => /job desc|jds/i.test(t.title)) + 1;
  check("ticks the Figma task", idx(h, h.rec.parsed.completedTaskIds).join() === String(figma), [idx(h, h.rec.parsed.completedTaskIds), figma]);
  check("does not tick the job-description task she only half did", !idx(h, h.rec.parsed.completedTaskIds).includes(jd), [idx(h, h.rec.parsed.completedTaskIds), jd]);
  check("skips mapping her teaching skills", idx(h, h.rec.parsed.skippedTaskIds).includes(map), [idx(h, h.rec.parsed.skippedTaskIds), map]);
  check("logs about 5 hours", h.rec.parsed.hoursSpent === 5, h.rec.parsed.hoursSpent);
  check("hears the lasting change to 6 hours a week", h.rec.parsed.hoursPerWeekFromNow === 6, h.rec.parsed.hoursPerWeekFromNow);
  check("exam marking is what got in the way", h.rec.parsed.blockers.some((x) => /mark|exam/i.test(x)) || /mark|exam/i.test(h.rec.parsed.notes + h.r.coachMessage), [h.rec.parsed.blockers, h.rec.parsed.notes]);

  console.log("\n4. A week where nothing was done because of illness");
  const s = await run("ill", arjun, "I was ill most of the week with a fever, so honestly nothing. I was in bed.");
  check("nothing is ticked", s.rec.parsed.completedTaskIds.length === 0, s.rec.parsed.completedTaskIds);
  check("no hours are made up (0)", s.rec.parsed.hoursSpent === 0, s.rec.parsed.hoursSpent);
  check("being ill is what got in the way", s.rec.parsed.blockers.some((x) => /ill|fever|sick|bed/i.test(x)), s.rec.parsed.blockers);
  check("it does not tick or invent anything for a week of nothing", s.profile.plan.weeks.find((w) => w.n === s.W)!.tasks.every((t) => t.status !== "done"));

  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall live check-in tests passed");
  process.exit(fails.length ? 1 : 0);
})();
