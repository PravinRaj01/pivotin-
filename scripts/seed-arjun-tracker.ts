// npm run seed:arjun-tracker
// Has the analyst agent explain the pattern in Arjun's 15 sample applications and saves it, so the tracker opens with
// the pattern and its explanation already there. The pattern itself is counted by code (lib/tracker.ts), not by the agent.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { arjun } from "../lib/seeds/arjun";
import type { ApplicationInsightResult } from "../lib/schemas/agents";
import { analyse, insightInput, shapeInsights } from "../lib/tracker";

const ROOT = join(__dirname, "..");
process.loadEnvFile(join(ROOT, ".env.local"));
if (process.env.GROQ_API_KEY && !process.env.KEEP_PROVIDER) process.env.LLM_PROVIDER = "groq";

(async () => {
  const p = { ...arjun, applicationInsights: undefined };
  const a = analyse(p);
  console.log(a.confidence.label, "| patterns:", a.patterns.map((x) => `${x.id} ${x.engaged}/${x.n} vs ${x.restEngaged}/${x.restN}`).join("; "));
  const { POST } = await import("../app/api/analyst/route");
  const res = await POST(new Request("http://local/api/analyst", { method: "POST", body: JSON.stringify(insightInput(p, a)) }));
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const insights = shapeInsights(p, a, (await res.json()) as ApplicationInsightResult, "2026-10-31T09:00:00.000Z");
  console.log("headline:", insights.headline);
  for (const f of insights.findings) console.log(" finding:", f.text);
  for (const s of insights.suggestions) console.log(` suggest [${s.kind}${s.role ? ": " + s.role : ""}]:`, s.text);
  console.log("caveat:", insights.caveat);
  writeFileSync(join(ROOT, "lib", "seeds", "arjun-tracker.json"), JSON.stringify({ insights }, null, 2) + "\n");
  console.log("saved lib/seeds/arjun-tracker.json");
})();
