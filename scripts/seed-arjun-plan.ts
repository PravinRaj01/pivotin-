// npm run seed:arjun-plan
// Builds Arjun's plan with the real planner and agents, then ticks off weeks 1 to 5 so he opens on week 6.
// PROGRESS_ONLY=1 keeps the saved plan and only resets how far through it he is (no model calls).
// Saves lib/seeds/arjun-plan.json (the plan, his projects, and prerequisites on his skills).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { toggleTask } from "../lib/plan";
import { buildPlan, type Call } from "../lib/plan-run";
import { arjun } from "../lib/seeds/arjun";

const ROOT = join(__dirname, "..");
process.loadEnvFile(join(ROOT, ".env.local"));
if (process.env.GROQ_API_KEY && !process.env.KEEP_PROVIDER) process.env.LLM_PROVIDER = "groq"; // save the Gemini daily quota

const call: Call = async (route, input) => {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(input) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
};

(async () => {
  let p = structuredClone(arjun);
  if (process.env.PROGRESS_ONLY) {
    // untick everything, including the project milestones, then tick below
    p.plan.weeks = p.plan.weeks.map((w) => ({ ...w, tasks: w.tasks.map((t) => ({ ...t, status: "todo" as const })) }));
    p.projects = p.projects.map((pr) => ({ ...pr, status: "suggested" as const, milestones: pr.milestones.map((m) => ({ ...m, done: false })) }));
  } else {
    p.plan = { generatedAt: "", revision: 0, weeks: [], uncovered: [], changelog: [] };
    p.projects = [];
    p.skills = p.skills.map((s) => ({ ...s, dependsOn: undefined }));
    const t0 = Date.now();
    p = await buildPlan(p, { reason: "First plan", today: "2026-10-31", call, onStep: (s) => console.log(`${String(s.pct).padStart(3)}%  ${s.label}`) });
    console.log(`built in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }

  // Arjun has done weeks 1 to 5. Ticking through toggleTask keeps the project milestones in step.
  for (const w of p.plan.weeks.filter((x) => x.n <= 5)) for (const t of w.tasks) p = toggleTask(p, t.id);

  const generatedAt = "2026-10-31T09:00:00.000Z";
  p.plan.generatedAt = generatedAt;
  p.plan.changelog = p.plan.changelog.map((c) => ({ ...c, at: generatedAt }));
  writeFileSync(join(ROOT, "lib", "seeds", "arjun-plan.json"), JSON.stringify({ skills: p.skills, plan: p.plan, projects: p.projects }, null, 2) + "\n");
  console.log("saved lib/seeds/arjun-plan.json");
})();
