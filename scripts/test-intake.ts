// npm run test:intake
// Runs the three messy transcripts through the real intake route (live model call, costs 3 requests)
// and checks the result against what a careful human would extract.
import { join } from "node:path";
import { INTAKE_CASES, INTAKE_TODAY } from "../lib/seeds/intake-tests";
import type { IntakeResult } from "../lib/schemas/intake";
import { applyIntake, chooseRole } from "../lib/intake";
import { emptyProfile } from "../lib/types";

process.loadEnvFile(join(__dirname, "..", ".env.local"));


const fails: string[] = [];
function check(id: string, name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(`${id}: ${name}`);
}
const has = (xs: string[], re: RegExp) => xs.some((x) => re.test(x));
const days = (iso: string) => (Date.parse(iso) - Date.parse(INTAKE_TODAY)) / 864e5;
const RANK = { close: 0, stretch: 1, leap: 2 } as const;

const EXPECT: Record<string, (r: IntakeResult, id: string) => void> = {
  warehouse(r, id) {
    check(id, "lives in Johannesburg", /johannesburg/i.test(r.person.location), r.person.location);
    check(id, "current role is a warehouse supervisor", /supervisor/i.test(r.person.currentRole), r.person.currentRole);
    check(id, "years = 12 (corrected from 11)", r.person.yearsExperience === 12, r.person.yearsExperience);
    check(id, "target is a planning role", /plan/i.test(r.goal.targetRole), r.goal.targetRole);
    check(id, "hours = 6 (corrected from 10)", r.goal.hoursPerWeek === 6, r.goal.hoursPerWeek);
    check(id, "deadline = 2027-08-31 (corrected from ten months)", r.goal.deadline === "2027-08-31", r.goal.deadline);
    check(id, "salary floor = 30000 per month, not the current 18000 or 22000", r.goal.salaryFloor?.amount === 30000 && r.goal.salaryFloor?.period === "month", r.goal.salaryFloor);
    check(id, "currency is rand", /zar|rand|r$/i.test(r.goal.salaryFloor?.currency ?? ""), r.goal.salaryFloor?.currency);
    check(id, "cities include Pretoria", has(r.goal.cities, /pretoria/i), r.goal.cities);
    check(id, "captured at least 3 corrections", r.corrections.length >= 3, r.corrections.length);
    check(id, "preference: dislikes night shifts", r.preferences.some((p) => p.kind === "dislike" && /night/i.test(p.text)), r.preferences);
    check(id, "preference: dislikes the paperwork", r.preferences.some((p) => p.kind === "dislike" && /paperwork|incident/i.test(p.text)), r.preferences);
    check(id, "tools include SAP and Excel", has(r.experience.flatMap((e) => e.toolsUsed), /sap/i) && has(r.experience.flatMap((e) => e.toolsUsed), /excel/i), r.experience.map((e) => e.toolsUsed));
    check(id, "football tangent left out of every field", !/football|formation|coach/i.test(JSON.stringify({ ...r, corrections: [] })), "mentions football");
    check(id, "no role suggestions (target was named)", r.roleSuggestions.length === 0, r.roleSuggestions.length);
    check(id, "no follow-up needed", !r.followUp, r.followUp);
  },
  chef(r, id) {
    check(id, "lives in Toronto", /toronto/i.test(r.person.location), r.person.location);
    check(id, "current role is sous chef", /sous/i.test(r.person.currentRole), r.person.currentRole);
    check(id, "target role left empty, not guessed", r.goal.targetRole === "", r.goal.targetRole);
    check(id, "offers 2 or 3 role suggestions", r.roleSuggestions.length >= 2 && r.roleSuggestions.length <= 3, r.roleSuggestions.length);
    const ranks = r.roleSuggestions.map((s) => RANK[s.distance]);
    check(id, "suggestions ranked closest first", ranks.every((v, i) => i === 0 || v >= ranks[i - 1]), r.roleSuggestions.map((s) => `${s.title}:${s.distance}`));
    check(id, "hours = 12", r.goal.hoursPerWeek === 12, r.goal.hoursPerWeek);
    check(id, "salary floor = 70000 CAD per year", r.goal.salaryFloor?.amount === 70000 && r.goal.salaryFloor?.period === "year", r.goal.salaryFloor);
    check(id, "timeline is about a year", r.goal.timelineWeeks >= 48 && r.goal.timelineWeeks <= 56, r.goal.timelineWeeks);
    check(id, "cities = Toronto only", r.goal.cities.length === 1 && /toronto/i.test(r.goal.cities[0]), r.goal.cities);
    check(id, "years is 8 or 9 (corrected from nine)", r.person.yearsExperience >= 8 && r.person.yearsExperience <= 9, r.person.yearsExperience);
    check(id, "preference: dislikes late nights or weekends", r.preferences.some((p) => p.kind === "dislike" && /night|weekend/i.test(p.text)), r.preferences);
    check(id, "preference: likes teaching", r.preferences.some((p) => p.kind === "like" && /teach|train/i.test(p.text)), r.preferences);
    check(id, "asks one follow-up about the role", r.followUp?.field === "targetRole" && (r.followUp?.question.length ?? 0) > 10, r.followUp);
  },
  civil(r, id) {
    check(id, "lives in Chennai", /chennai/i.test(r.person.location), r.person.location);
    check(id, "current role is a site engineer", /site|civil/i.test(r.person.currentRole), r.person.currentRole);
    check(id, "years = 6 (corrected from 5)", r.person.yearsExperience === 6, r.person.yearsExperience);
    check(id, "target is planning or GIS", /plan|gis/i.test(r.goal.targetRole) || has(r.goal.alternateRoles, /plan|gis/i), [r.goal.targetRole, r.goal.alternateRoles]);
    check(id, "hours not guessed (0)", r.goal.hoursPerWeek === 0, r.goal.hoursPerWeek);
    check(id, "asks the hours question", r.followUp?.field === "hoursPerWeek", r.followUp);
    check(id, "timeline is about 8 months, not 12", r.goal.timelineWeeks >= 32 && r.goal.timelineWeeks <= 37, r.goal.timelineWeeks);
    const d = days(r.goal.deadline);
    check(id, "deadline about 8 months out", d >= 225 && d <= 260, r.goal.deadline);
    check(id, "salary floor = 900000 INR per year, not the current 6 lakh", r.goal.salaryFloor?.amount === 900000, r.goal.salaryFloor);
    check(id, "cities include Chennai and Bengaluru", has(r.goal.cities, /chennai/i) && has(r.goal.cities, /bengaluru|bangalore/i), r.goal.cities);
    check(id, "preference: dislikes site heat", r.preferences.some((p) => p.kind === "dislike" && /heat|site|outdoor/i.test(p.text)), r.preferences);
    check(id, "preference: likes maps or mapping", r.preferences.some((p) => p.kind === "like" && /map|gis|data/i.test(p.text)), r.preferences);
    check(id, "captured years and timeline corrections", r.corrections.length >= 2, r.corrections.length);
    check(id, "storm tangent left out", !/storm|flood/i.test(JSON.stringify({ ...r, corrections: [] })), "mentions storm");
    check(id, "no invented role suggestions (target named)", r.roleSuggestions.length === 0, r.roleSuggestions.length);
  },
};

// What the profile looks like after the result is merged in, as the screen does it.
const APPLY: Record<string, (r: IntakeResult, id: string, transcript: string) => void> = {
  warehouse(r, id, t) {
    const p = applyIntake(emptyProfile(), r, t, INTAKE_TODAY);
    check(id, "profile: 6 hours, planner role, deadline stored", p.goal.hoursPerWeek === 6 && /plan/i.test(p.goal.targetRole) && p.goal.deadline === "2027-08-31", p.goal);
    check(id, "profile: salary floor stored", p.goal.salaryFloor?.amount === 30000, p.goal.salaryFloor);
    check(id, "profile: no open question", p.story.followUp === null && p.story.roleSuggestions.length === 0, p.story.followUp);
    const twice = applyIntake(p, r, t, INTAKE_TODAY);
    check(id, "second pass does not duplicate transcripts or preferences", twice.story.rawTranscripts.length === 1 && twice.story.preferences.length === p.story.preferences.length, [twice.story.rawTranscripts.length, twice.story.preferences.length]);
  },
  chef(r, id, t) {
    const p = applyIntake(emptyProfile(), r, t, INTAKE_TODAY);
    check(id, "profile: target role stays empty", p.goal.targetRole === "", p.goal.targetRole);
    check(id, "profile: suggestions and question are kept", p.story.roleSuggestions.length >= 2 && !!p.story.followUp, [p.story.roleSuggestions.length, p.story.followUp]);
    const picked = chooseRole(p, p.story.roleSuggestions[0].title);
    check(id, "choosing a suggestion sets the role and closes the question", picked.goal.targetRole === p.story.roleSuggestions[0].title && picked.story.roleSuggestions.length === 0 && picked.story.followUp === null, picked.story.followUp);
  },
  civil(r, id, t) {
    const p = applyIntake(emptyProfile(), r, t, INTAKE_TODAY);
    check(id, "profile: hours stay 0 (not defaulted to 8)", p.goal.hoursPerWeek === 0, p.goal.hoursPerWeek);
    check(id, "profile: follow-up asks about hours", p.story.followUp?.field === "hoursPerWeek", p.story.followUp);
    const answered = applyIntake(p, { ...r, goal: { ...r.goal, hoursPerWeek: 7, targetRole: "", timelineWeeks: 0, deadline: "" }, followUp: null, corrections: [], preferences: [] }, t + "\nMy answer: 7", INTAKE_TODAY);
    check(id, "answering fills hours and keeps earlier facts", answered.goal.hoursPerWeek === 7 && answered.goal.salaryFloor?.amount === 900000 && answered.goal.timelineWeeks === p.goal.timelineWeeks && answered.story.followUp === null, answered.goal);
  },
};

(async () => {
  const { POST } = await import("../app/api/intake/route");
  for (const c of INTAKE_CASES.filter((x) => !process.env.ONLY || x.id === process.env.ONLY)) {
    console.log(`\n${c.label}`);
    const t0 = Date.now();
    const res = await POST(new Request("http://local/api/intake", { method: "POST", body: JSON.stringify({ transcript: c.transcript, today: INTAKE_TODAY }) }));
    if (!res.ok) {
      check(c.id, `route answered (${res.status}: ${await res.text()})`, false);
      continue;
    }
    const raw = await res.json();
    const { IntakeResultSchema } = await import("../lib/schemas/intake");
    const parsed = IntakeResultSchema.safeParse(raw);
    check(c.id, `valid against the schema (${((Date.now() - t0) / 1000).toFixed(1)}s)`, parsed.success);
    if (!parsed.success) continue;
    EXPECT[c.id](parsed.data, c.id);
    APPLY[c.id](parsed.data, c.id, c.transcript);
    if (process.env.SHOW) console.log(JSON.stringify(parsed.data, null, 1));
  }
  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall intake tests passed");
  process.exit(fails.length ? 1 : 0);
})();
