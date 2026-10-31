// npm run test:interview-live   (live model calls, about 6 requests)
// 1. The rubric agent writes a different rubric for three different roles (nothing is hardcoded).
// 2. The interviewer scores a strong and a weak answer differently, quotes real words, and asks a real follow-up.
// 3. Messy delivery and transform tags do not change a score: only the content counts.
import { join } from "node:path";
import { FIRST_QUESTION, applyTurn, interviewInput, planNext, rubricInput, shapeRubric, startSession, stripTransformTags, activeSession, verifyQuote } from "../lib/interview";
import type { InterviewTurnResult, RubricResult } from "../lib/schemas/agents";
import { arjun } from "../lib/seeds/arjun";
import { teacher } from "../lib/seeds/teacher";
import { emptyProfile } from "../lib/types";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const NOW = "2026-11-01T10:00:00.000Z";

async function post<T>(route: string, body: unknown): Promise<T> {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(body) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 4));

(async () => {
  console.log("\n1. A rubric for each role, written from the role and its job descriptions");
  const dataRole = { ...emptyProfile(NOW, "d"), goal: { ...emptyProfile(NOW, "d").goal, targetRole: "Data Analyst", targetIndustry: "Banking or telecoms" } };
  const roles = [
    { label: "Associate Product Manager (Arjun)", p: arjun },
    { label: "UX Designer (Hannah)", p: teacher },
    { label: "Data Analyst (role name only, no job descriptions)", p: dataRole },
  ];
  const rubrics = [];
  for (const r of roles) {
    const rubric = shapeRubric(r.p, await post<RubricResult>("rubric", rubricInput(r.p)), NOW);
    rubrics.push(rubric);
    console.log(`   ${r.label}: ${rubric.dimensions.map((d) => d.name).join(" | ")}`);
    check(`${r.label}: 4 dimensions, each with 4 different level lines`, rubric.dimensions.length === 4 && rubric.dimensions.every((d) => new Set(d.levels).size === 4));
    check(`${r.label}: level lines are short, one line each`, rubric.dimensions.every((d) => d.levels.every((l) => l.split(" ").length <= 26)), rubric.dimensions.flatMap((d) => d.levels).filter((l) => l.split(" ").length > 26));
  }
  const names = rubrics.map((r) => new Set(r.dimensions.map((d) => d.name.toLowerCase())));
  const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;
  check("the three roles got different rubrics (at most one shared dimension name between any two)", overlap(names[0], names[1]) <= 1 && overlap(names[0], names[2]) <= 1 && overlap(names[1], names[2]) <= 1, [overlap(names[0], names[1]), overlap(names[0], names[2]), overlap(names[1], names[2])]);
  check("most dimensions link to real skills when job descriptions exist", rubrics[0].dimensions.filter((d) => d.skillIds.length).length >= 2 && rubrics[1].dimensions.filter((d) => d.skillIds.length).length >= 2, rubrics.slice(0, 2).map((r) => r.dimensions.map((d) => d.skillIds.length)));

  console.log("\n2. Scoring: strong vs weak, evidence, follow-up (Arjun's rubric)");
  const base = { ...arjun, rubric: rubrics[0], interviews: [] as typeof arjun.interviews };
  const STRONG = "For four years I have found bugs that were not code bugs but requirement bugs. On the client portal migration we shipped a flow nobody had asked users about, and I traced three payment defects back to that one missing decision. I want to be the person who makes that call early, using what I know about how things break. I am not leaving quality behind, I want to apply it earlier, and I have started by interviewing five users about failed payments.";
  const WEAK = "I just want a change really. Product management sounds interesting and I heard it pays more and has better work life balance, so I thought why not try it.";
  const run = async (answer: string) => {
    const s0 = startSession(base, NOW, "x");
    const s = activeSession(s0)!;
    const next = planNext(s, s0.rubric!);
    const r = await post<InterviewTurnResult>("interview", interviewInput(s0, s, answer, next));
    return { applied: applyTurn(s0, s.id, r, answer, next, NOW), r };
  };
  const strong = await run(STRONG);
  const weak = await run(WEAK);
  const turn = (x: typeof strong) => x.applied.interviews[0].turns[0];
  const avg = (x: typeof strong) => turn(x).scores.reduce((a, s) => a + s.score, 0) / turn(x).scores.length;
  for (const [name, x] of [["strong", strong], ["weak", weak]] as const) {
    console.log(`   ${name}: ${turn(x).scores.map((s) => `${x.applied.rubric!.dimensions.find((d) => d.id === s.dimensionId)!.name} ${s.score}/4 "${s.quote.slice(0, 50)}"`).join("; ")}`);
    console.log(`          improve: ${turn(x).improve}`);
    console.log(`          follow-up: ${x.r.nextQuestion}`);
  }
  check("the strong answer scores higher than the weak one", avg(strong) > avg(weak), [avg(strong), avg(weak)]);
  check("the weak answer has a weak score (1 or 2)", turn(weak).scores.some((s) => s.score <= 2), turn(weak).scores.map((s) => s.score));
  check("the strong answer has a good score (3 or 4)", turn(strong).scores.some((s) => s.score >= 3), turn(strong).scores.map((s) => s.score));
  check("every score has a quote that is word for word in the answer", [strong, weak].every((x) => turn(x).scores.every((s) => s.verified && s.quote.length > 3)), [strong, weak].flatMap((x) => turn(x).scores.filter((s) => !s.verified).map((s) => s.quote)));
  check("each answer gets one concrete improvement", [strong, weak].every((x) => turn(x).improve.length > 20));
  check("the follow-up is a different question that picks up the answer's own words", [strong, weak].every((x) => x.r.nextQuestion !== FIRST_QUESTION && [...words(x.r.nextQuestion)].some((w) => words(x.applied.interviews[0].turns[0].answer).has(w))), [strong, weak].map((x) => x.r.nextQuestion));
  check("exactly one follow-up question is stored as pending", [strong, weak].every((x) => x.applied.interviews[0].pending?.kind === "followup" && x.applied.interviews[0].pending.question.split("?").length <= 3));
  const lowered = weak.applied.skills.filter((s, i) => s.current < arjun.skills[i].current);
  console.log(`   weak answer lowered: ${lowered.map((s) => `${s.label} ${arjun.skills.find((a) => a.id === s.id)!.current}->${s.current}`).join(", ") || "nothing (its weak dimensions link to no skill)"}`);
  check("skills only change when a weak score is backed by a real quote", weak.applied.skills.every((s, i) => s.current === arjun.skills[i].current || turn(weak).skillChanges.some((c) => c.skillId === s.id)));
  check("the strong answer lowers no skill", strong.applied.skills.every((s, i) => s.current === arjun.skills[i].current));

  console.log("\n3. Only content counts: messy delivery and transform tags");
  const MESSY = "[GOAL] so um for like four years i found bugs right, not code bugs, requirement bugs. [EXPERIENCE] the client portal migration we shipped a flow nobody had asked users about and i traced 3 payment defects to that one missing decision. i wanna be the one who makes that call early, using what i know about how things break. not leaving quality behind just applying it earlier, and ive started interviewing 5 users about failed payments";
  const cleaned = stripTransformTags(MESSY);
  check("transform tags are gone from the answer that is scored", !/\[GOAL\]|\[EXPERIENCE\]/.test(cleaned));
  const messy = await run(cleaned);
  console.log(`   messy: ${turn(messy).scores.map((s) => `${messy.applied.rubric!.dimensions.find((d) => d.id === s.dimensionId)!.name} ${s.score}/4`).join("; ")}   (polished: ${avg(strong).toFixed(1)}, messy: ${avg(messy).toFixed(1)})`);
  check("the messy answer with the same content scores within 1 point of the polished one", Math.abs(avg(messy) - avg(strong)) <= 1, [avg(strong), avg(messy)]);
  check("the messy answer is not marked down as weak", !turn(messy).scores.every((s) => s.score <= 2), turn(messy).scores.map((s) => s.score));
  check("its quotes are found in the cleaned answer", turn(messy).scores.every((s) => verifyQuote(cleaned, s.quote)));

  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall live interview tests passed");
  process.exit(fails.length ? 1 : 0);
})();
