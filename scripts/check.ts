// npm run check
// 1. Every agent prompt is role-neutral (no profession, tool or skill list baked in).
// 2. Every agent route exists, validates its output with Zod and has its own file.
// 3. Both seed personas pass the Pivot Profile schema.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PERSONAS } from "../lib/seeds";
import { PivotProfileSchema } from "../lib/types";

const ROOT = join(__dirname, "..");
const AGENTS = ["intake", "jd", "bridge", "rubric", "sequence", "plan", "projects", "interview", "checkin", "application"];

// Words that would mean a prompt knows about a specific career. Deliberately broad.
const BANNED = [
  "product manager", "\\bapm\\b", "\\bux\\b", "\\bui\\b", "\\bqa\\b", "tester", "\\bsql\\b", "\\bprd\\b", "figma", "wireframe",
  "a/b test", "roadmap", "data analyst", "teacher", "nurse", "software engineer", "developer", "designer", "marketing",
  "accountant", "lawyer", "python", "javascript", "excel", "jira", "postman", "okr", "agile", "scrum", "pune", "india", "bengaluru",
];

let failed = 0;
const fail = (m: string) => {
  failed++;
  console.error("FAIL", m);
};
const ok = (m: string) => console.log("ok  ", m);

for (const a of AGENTS) {
  const file = join(ROOT, "app", "api", a, "route.ts");
  if (!existsSync(file)) {
    fail(`${a}: missing app/api/${a}/route.ts`);
    continue;
  }
  const src = readFileSync(file, "utf8");
  const m = src.match(/const SYSTEM = `([\s\S]*?)`;/);
  if (!m) {
    fail(`${a}: no SYSTEM prompt found`);
    continue;
  }
  const hits = BANNED.filter((w) => new RegExp(w, "i").test(m[1]));
  hits.length ? fail(`${a}: prompt names role-specific terms: ${hits.join(", ")}`) : ok(`${a}: prompt is role-neutral`);
  const validated = /Schema/.test(src) && (/agentRoute\(/.test(src) || /runAgent\(/.test(src));
  validated ? ok(`${a}: output validated with Zod`) : fail(`${a}: route does not validate with a schema`);
}

const routes = readdirSync(join(ROOT, "app", "api")).filter((d) => d !== "health");
for (const r of routes) if (!AGENTS.includes(r)) fail(`app/api/${r} is not in the agent list`);

for (const p of PERSONAS) {
  const r = PivotProfileSchema.safeParse(p.profile);
  r.success ? ok(`seed ${p.id}: valid (${p.profile.applications.length} applications, ${p.profile.skills.length} skills)`) : fail(`seed ${p.id}: ${JSON.stringify(r.error.issues.slice(0, 3))}`);
}
const arjun = PERSONAS.find((p) => p.id === "arjun")!.profile;
arjun.applications.length === 15 ? ok("arjun has 15 sample applications") : fail(`arjun has ${arjun.applications.length} applications, expected 15`);
const levels = arjun.skills.every((s) => Number.isInteger(s.current) && Number.isInteger(s.required) && s.current <= 3 && s.required <= 3);
levels ? ok("skill levels are whole numbers 0-3") : fail("skill levels outside 0-3");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
