// npm run test:tracker-live   (live model calls, 6 requests)
// Does the logging agent turn speech into the right row, and does the analyst stay inside what the code found?
import { join } from "node:path";
import { arjun } from "../lib/seeds/arjun";
import { teacher } from "../lib/seeds/teacher";
import type { ApplicationInsightResult, ApplicationLogResult } from "../lib/schemas/agents";
import { analyse, applyLog, insightInput, shapeInsights, trackerInput } from "../lib/tracker";
import type { PivotProfile } from "../lib/types";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const TODAY = "2026-11-01"; // a Sunday

async function post<T>(route: string, body: unknown): Promise<T> {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(body) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function say(label: string, p: PivotProfile, utterance: string) {
  const r = await post<ApplicationLogResult>("application", trackerInput(p, utterance, TODAY));
  const out = applyLog(p, r, TODAY, "new");
  const a = out.row;
  console.log(`   ${label}: ${out.mode} | ${a.company} | ${a.role} | family="${a.roleFamily}" stage="${a.companyStage}" industry="${a.industry}" | ${a.channel || "-"} | ${a.resumeVersion || "-"} | ${a.status} | ${a.dates.applied ?? "-"} | guessed: ${a.inferred.join(",") || "none"}`);
  return { out, raw: r };
}

(async () => {
  console.log("\n1. The example from the brief (Swiggy is saved in the tracker)");
  const s = await say("swiggy", arjun, "Applied to Swiggy through a referral yesterday with my version 2 resume.");
  check("it updates the saved Swiggy row instead of adding a duplicate", s.out.mode === "updated" && s.out.profile.applications.length === 15);
  check("status applied, channel Referral, resume Version 2, on 31 Oct", s.out.row.status === "applied" && s.out.row.channel === "Referral" && s.out.row.resumeVersion === "Version 2" && s.out.row.dates.applied === "2026-10-31", s.out.row);

  console.log("\n2. News about an application");
  const o = await say("okta", arjun, "Heard back from Okta, a recruiter emailed to set up a screening call.");
  check("Okta moves to Response, nothing else changes", o.out.mode === "updated" && o.out.row.status === "response" && o.out.row.channel === "Careers page" && o.out.profile.applications.length === 15, o.out.row.status);
  const c = await say("cleartax", arjun, "Cleartax said no.");
  check("a rejection with no role said updates the right company", c.out.mode === "updated" && c.out.row.company === "Cleartax" && c.out.row.status === "rejected");

  console.log("\n3. A new application, rambling, with a correction and a tangent");
  const n = await say("nykaa", arjun, "Okay so I put in an application at Nykaa, the associate product manager role, no wait, it was the product analyst role, through LinkedIn on Monday, I used my first resume. My dog barked the whole time, anyway.");
  check("added as a new row for the corrected role", n.out.mode === "added" && n.out.row.company === "Nykaa" && /analyst/i.test(n.out.row.role) && !/associate product manager/i.test(n.out.row.role), n.out.row.role);
  check("LinkedIn is a Job board, 'first resume' is Version 1", n.out.row.channel === "Job board" && n.out.row.resumeVersion === "Version 1", [n.out.row.channel, n.out.row.resumeVersion]);
  check("'Monday' is the most recent Monday: 26 Oct", n.out.row.dates.applied === "2026-10-26", n.out.row.dates.applied);
  check("the role family reuses the wording already in the tracker", n.out.row.roleFamily === "Product analyst", n.out.row.roleFamily);
  check("the dog is not in the notes", !/dog|bark/i.test(n.out.row.notes));
  check("it is one new row, not a duplicate", n.out.profile.applications.length === 16);

  console.log("\n4. A different field (Hannah, teacher to UX), a company the model cannot know");
  const h = await say("northlight", teacher, "Applied today to Northlight Digital, a small agency, for the junior UX designer job through their careers page with CV version 1.");
  check("a new row with the right company, channel and resume", h.out.mode === "added" && /northlight/i.test(h.out.row.company) && h.out.row.channel === "Careers page" && h.out.row.resumeVersion === "Version 1" && h.out.row.dates.applied === TODAY, h.out.row);
  check("the kind of role is filled from the job title", /ux|design/i.test(h.out.row.roleFamily), h.out.row.roleFamily);
  check("an unknown company's industry is not invented as fact (empty or marked as a guess)", !h.out.row.industry || h.out.row.inferred.includes("industry"), [h.out.row.industry, h.out.row.inferred]);

  console.log("\n5. The analyst explains only what the code found");
  const A = analyse(arjun);
  const r = await post<ApplicationInsightResult>("analyst", insightInput(arjun, A));
  const ins = shapeInsights(arjun, A, r, TODAY);
  console.log(`   ${ins.headline}\n   ${ins.findings.map((f) => f.text).join(" | ")}\n   ${ins.suggestions.map((x) => `[${x.kind}] ${x.text}`).join(" | ")}\n   caveat: ${ins.caveat}`);
  check("the headline starts with the confidence label and the count", ins.headline.startsWith("Early signal, 12 applications"), ins.headline);
  check("the finding uses the exact counts, 5 of 5 against 1 of 7", /5 of 5/.test(ins.findings[0].text) && /1 of 7/.test(ins.findings[0].text), ins.findings[0].text);
  check("it only talks about the one pattern that exists", ins.findings.length === 1 && ins.findings[0].patternId === "channel:Referral" && ins.suggestions.every((x) => x.patternId === "channel:Referral"));
  check("it hedges, and does not say anything is proven", /might|so far|looks|appear|could|early/i.test(ins.findings[0].text + ins.headline) && !/prove|guarantee|definitely|cause/i.test(ins.findings[0].text));
  check("the caveat mentions the small numbers or the number of comparisons", ins.caveat.length > 20 && /small|comparison|chance|uncertain/i.test(ins.caveat), ins.caveat);
  check("it offers at least one concrete suggestion", ins.suggestions.length >= 1);
  const refuses = await (await import("../app/api/analyst/route")).POST(new Request("http://x", { method: "POST", body: JSON.stringify({ patterns: [] }) }));
  check("asked to explain no pattern at all, the route refuses", refuses.status === 400);

  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall live tracker tests passed");
  process.exit(fails.length ? 1 : 0);
})();
