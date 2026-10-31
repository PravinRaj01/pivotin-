// npm run test:interview   (offline, no model calls)
// The rules around the mock interview: question order, quote checking, ignoring transform tags,
// and exactly when a skill level goes down.
import {
  FIRST_QUESTION, TOTAL_QUESTIONS, picksUp, activeSession, applyTurn, dimensionAverages, lowerSkill, planNext, rubricKey, rubricStale, shapeRubric, startSession, stripTransformTags, verifyQuote,
} from "../lib/interview";
import type { InterviewTurnResult } from "../lib/schemas/agents";
import { arjun } from "../lib/seeds/arjun";

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const NOW = "2026-11-01T10:00:00.000Z";

// Two real skills from Arjun's map to link the rubric to.
const have = arjun.skills.find((s) => s.status === "have" && s.current === 2)!;
const trans = arjun.skills.find((s) => s.status === "transferable" && s.current === 1)!;
const other = arjun.skills.find((s) => s.status === "have" && s.id !== have.id)!;

const raw = {
  dimensions: [
    { id: "alpha", name: "Alpha thinking", what: "a", levels: ["a1", "a2", "a3", "a4"], skillIds: [have.id, "not-a-skill", trans.id, other.id] },
    { id: "beta", name: "Beta depth", what: "b", levels: ["b1", "b2", "b3", "b4"], skillIds: [trans.id] },
    { id: "gamma", name: "Gamma sense", what: "c", levels: ["c1", "c2", "c3", "c4"], skillIds: [] },
    { id: "delta", name: "Delta clarity", what: "d", levels: ["d1", "d2", "d3", "d4"], skillIds: [other.id] },
    { id: "extra", name: "Fifth one", what: "e", levels: ["e1", "e2", "e3", "e4"], skillIds: [] },
  ],
};

console.log("\nRubric shape");
const rubric = shapeRubric(arjun, raw, NOW);
check("only the first 4 dimensions are kept", rubric.dimensions.length === 4 && !rubric.dimensions.some((d) => d.id === "extra"));
check("skill links are real ids and at most 2", rubric.dimensions[0].skillIds.length === 2 && !rubric.dimensions[0].skillIds.includes("not-a-skill"), rubric.dimensions[0].skillIds);
const thrown = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check("fewer than 4 dimensions is rejected", thrown(() => shapeRubric(arjun, { dimensions: raw.dimensions.slice(0, 3) }, NOW)));
check("a dimension without 4 level lines is rejected", thrown(() => shapeRubric(arjun, { dimensions: raw.dimensions.map((d, i) => (i === 1 ? { ...d, levels: ["x", "y", "z"] } : d)) }, NOW)));
check("a repeated dimension is rejected", thrown(() => shapeRubric(arjun, { dimensions: raw.dimensions.map((d, i) => (i === 2 ? { ...d, name: "alpha thinking" } : d)) }, NOW)));
const withRubric = { ...arjun, rubric, interviews: [] as typeof arjun.interviews };
check("a rubric is fresh until the role changes", !rubricStale(withRubric) && rubricStale({ ...withRubric, goal: { ...withRubric.goal, targetRole: "Data Analyst" } }));
check("the rubric key names the role", rubricKey(arjun).startsWith("associate product manager|"), rubricKey(arjun));

console.log("\nQuestion order");
const started = startSession(withRubric, NOW, "s1");
check("the first question is always 'Why are you switching careers?'", started.interviews[0].pending?.question === FIRST_QUESTION && started.interviews[0].pending?.kind === "switch");
check("starting twice does not create a second interview", startSession(started, NOW, "s2").interviews.length === 1);
check("an unfinished interview is the active one", activeSession(started)?.id === "s1");

const good = (dimension: string, score: number, quote: string): InterviewTurnResult["scores"][number] => ({ dimension, score, quote, why: "because" });
const ANSWER = "I kept finding requirement bugs. Nobody had asked users what they wanted, so we built the wrong thing.";
let p = started;
const step = (answer: string, scores: InterviewTurnResult["scores"], nextQuestion: string) => {
  const s = activeSession(p)!;
  const next = planNext(s, p.rubric!);
  p = applyTurn(p, s.id, { scores, improve: "Name a number.", nextQuestion }, answer, next, NOW);
};
check("after the first answer exactly one follow-up is asked", planNext(activeSession(p)!, rubric).kind === "followup");
step(ANSWER, [good("alpha", 3, "Nobody had asked users what they wanted")], "You said nobody asked users. What would you have asked?");
check("the follow-up is stored as the next question and marked a follow-up", activeSession(p)!.pending?.kind === "followup");
check("after the follow-up, role questions begin", planNext(activeSession(p)!, rubric).kind === "role");
const nxt = planNext(activeSession(p)!, rubric);
check("a role question targets a dimension not yet scored", nxt.dimensionId !== "alpha", nxt);
step("I would ask what they tried before.", [good("beta", 3, "ask what they tried before")], "How would you choose between two features?");
const n3 = planNext(activeSession(p)!, rubric);
check("it picks a dimension that has no scores yet, not one already covered", !["alpha", "beta"].includes(n3.dimensionId!) || false, n3);
step("I would compare effort and impact.", [good("gamma", 3, "compare effort and impact")], "How would you measure it?");
step("By watching drop-off.", [good("delta", 3, "watching drop-off")], "Last one: how would you tell the team?");
check("the fifth question is the last: nothing comes after it", planNext(activeSession(p)!, rubric).kind === "none" && activeSession(p)!.turns.length === TOTAL_QUESTIONS - 1);
step("I would write a short note.", [good("alpha", 3, "write a short note")], "");
const done = p.interviews[0];
check("finishing sets the end time and leaves no pending question", !!done.finishedAt && done.pending === null && done.turns.length === TOTAL_QUESTIONS, done.turns.length);
check("an interview with 5 answered questions has asked exactly the opener first", done.turns[0].question === FIRST_QUESTION && done.turns[0].kind === "switch");
check("the second question is the follow-up", done.turns[1].kind === "followup");
check("averages are worked out per dimension", dimensionAverages(done, rubric).find((d) => d.dimension.id === "alpha")!.n === 2);

console.log("\nA follow-up must be about the answer");
check("a follow-up that uses the person's own words is accepted", picksUp(ANSWER, "You said nobody asked users. What would you have asked them first?"));
check("a generic question that could follow any answer is refused", !picksUp(ANSWER, "What aspects of the day-to-day work appeal to you the most?"));
check("applying a follow-up that picks up nothing is refused", thrown(() => { const s0 = startSession(withRubric, NOW, "f"); const s = activeSession(s0)!; applyTurn(s0, s.id, { scores: [good("alpha", 3, "nobody")], improve: "x", nextQuestion: "How do you feel about the weather there?" }, ANSWER, planNext(s, s0.rubric!), NOW); }));

console.log("\nQuotes");
check("an exact quote is verified, ignoring case and punctuation", verifyQuote(ANSWER, "NOBODY had asked users what they wanted!"));
check("a paraphrase is not verified", !verifyQuote(ANSWER, "No one asked the users what they needed"));
check("an empty quote is not verified", !verifyQuote(ANSWER, ""));
check("two separate sentences stitched together are not verified", !verifyQuote(ANSWER, "I kept finding requirement bugs so we built the wrong thing"));

console.log("\nTransform tags");
check("transform tags are removed from an answer", stripTransformTags("[GOAL] I want to decide what gets built. [EXPERIENCE] four years of QA") === "I want to decide what gets built. four years of QA", stripTransformTags("[GOAL] I want to decide what gets built. [EXPERIENCE] four years of QA"));
check("ordinary bracketed words in an answer are kept", stripTransformTags("The [dashboard] showed a [big] drop") === "The [dashboard] showed a [big] drop");
check("a quote from the cleaned answer verifies even if the raw text had tags", verifyQuote(stripTransformTags("[GOAL] I want to decide what gets built"), "decide what gets built"));

console.log("\nWhen a skill goes down");
const mk = (answer: string, scores: InterviewTurnResult["scores"], pre = withRubric) => {
  const s0 = startSession(pre, NOW, "t");
  const s = activeSession(s0)!;
  return applyTurn(s0, s.id, { scores, improve: "x", nextQuestion: "You said nobody had asked users. What would you ask them first?" }, answer, planNext(s, s0.rubric!), NOW);
};
const lvl = (pp: typeof p, id: string) => pp.skills.find((s) => s.id === id)!;
const weak = mk(ANSWER, [good("alpha", 2, "nobody had asked users")]);
check("a weak score (2) with a real quote lowers the linked skills by one level", lvl(weak, have.id).current === have.current - 1 && lvl(weak, trans.id).current === trans.current - 1, [lvl(weak, have.id).current, lvl(weak, trans.id).current]);
check("the change is recorded on the turn", weak.interviews[0].turns[0].skillChanges.length === 2 && weak.interviews[0].turns[0].skillChanges.every((c) => c.to === c.from - 1));
check("a skill with no link is untouched", lvl(weak, other.id).current === other.current);
check("a 'have' skill that drops below working level becomes transferable", lvl(weak, have.id).status === "transferable", lvl(weak, have.id).status);
check("a transferable skill at level 1 drops to missing and loses its quote", lvl(weak, trans.id).status === "missing" && lvl(weak, trans.id).evidence.length === 0, lvl(weak, trans.id));
check("a middling score (3) changes nothing", mk(ANSWER, [good("alpha", 3, "nobody had asked users")]).skills.every((s, i) => s.current === arjun.skills[i].current));
check("a strong score (4) changes nothing", mk(ANSWER, [good("alpha", 4, "nobody had asked users")]).skills.every((s, i) => s.current === arjun.skills[i].current));
check("a weak score with an invented quote changes nothing", mk(ANSWER, [good("alpha", 1, "they never listened to customers")]).skills.every((s, i) => s.current === arjun.skills[i].current));
check("that score is kept but marked as not verified", mk(ANSWER, [good("alpha", 1, "they never listened to customers")]).interviews[0].turns[0].scores[0].verified === false);
check("a weak score on a dimension with no linked skill changes nothing", mk(ANSWER, [good("gamma", 1, "nobody had asked users")]).skills.every((s, i) => s.current === arjun.skills[i].current));
// twice in one interview
let twice = mk(ANSWER, [good("alpha", 1, "nobody had asked users")]);
const s2 = activeSession(twice)!;
twice = applyTurn(twice, s2.id, { scores: [good("alpha", 1, "built the wrong thing")], improve: "x", nextQuestion: "Yet another question here?" }, ANSWER, planNext(s2, twice.rubric!), NOW);
check("a skill drops at most once per interview", lvl(twice, have.id).current === have.current - 1 && twice.interviews[0].turns[1].skillChanges.length === 0, [lvl(twice, have.id).current, twice.interviews[0].turns[1].skillChanges]);
check("a skill already at level 0 cannot go lower", lowerSkill({ ...lvl(weak, trans.id) }).current === 0);
check("scores for unknown dimensions are ignored", mk(ANSWER, [good("nope", 1, "nobody had asked users"), good("alpha", 3, "nobody had asked users")]).interviews[0].turns[0].scores.length === 1);
check("no matching dimension at all is an error", thrown(() => mk(ANSWER, [good("nope", 1, "x")])));
check("at most two dimensions are scored per answer", mk(ANSWER, [good("alpha", 3, "nobody"), good("beta", 3, "nobody"), good("gamma", 3, "nobody")]).interviews[0].turns[0].scores.length === 2);
check("a repeated question is refused", thrown(() => { const s0 = startSession(withRubric, NOW, "u"); const s = activeSession(s0)!; applyTurn(s0, s.id, { scores: [good("alpha", 3, "nobody")], improve: "", nextQuestion: "why are you switching careers" }, ANSWER, planNext(s, s0.rubric!), NOW); }));
check("interview data stays valid for the saved profile shape", (() => { const j = JSON.parse(JSON.stringify(p)); return Array.isArray(j.interviews[0].turns[0].scores) && j.rubric.dimensions.length === 4; })());

console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall interview tests passed");
process.exit(fails.length ? 1 : 0);
