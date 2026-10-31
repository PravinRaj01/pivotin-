// npm run seed:arjun-interview
// Has the rubric agent write the rubric for Arjun's role, then puts him one question into a mock interview:
// his answer to "Why are you switching careers?" scored by the interviewer agent, with the follow-up waiting.
// Saves lib/seeds/arjun-interview.json. His skill levels are deliberately left as they are in the seed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { activeSession, applyTurn, interviewInput, planNext, rubricInput, shapeRubric, startSession } from "../lib/interview";
import type { InterviewTurnResult, RubricResult } from "../lib/schemas/agents";
import { arjun } from "../lib/seeds/arjun";

const ROOT = join(__dirname, "..");
process.loadEnvFile(join(ROOT, ".env.local"));
if (process.env.GROQ_API_KEY && !process.env.KEEP_PROVIDER) process.env.LLM_PROVIDER = "groq";

const NOW = "2026-10-31T09:00:00.000Z";
const ANSWER =
  "Honestly it started with testing. For four years the bugs I found most were not code bugs, they were requirement bugs, like the bank portal migration where we shipped a flow nobody had asked users about. By the time it reached me the real decision had already been made. I want to be in the room where that decision is made, and I think four years of seeing exactly how things break gives me something to bring. I am not leaving quality behind, I want to use it earlier.";

async function post<T>(route: string, body: unknown): Promise<T> {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(body) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  let p = structuredClone(arjun);
  p.rubric = undefined;
  p.interviews = [];
  p.rubric = shapeRubric(p, await post<RubricResult>("rubric", rubricInput(p)), NOW);
  console.log("rubric:", p.rubric.dimensions.map((d) => d.name).join(" | "));

  p = startSession(p, NOW, "i1");
  const s = activeSession(p)!;
  const next = planNext(s, p.rubric!);
  const r = await post<InterviewTurnResult>("interview", interviewInput(p, s, ANSWER, next));
  p = applyTurn(p, s.id, r, ANSWER, next, NOW);
  p.interviews = p.interviews.map((i) => ({ ...i, turns: i.turns.map((t) => ({ ...t, skillChanges: [] })) })); // seed keeps his skill levels as they are

  const turn = p.interviews[0].turns[0];
  console.log("scores:", turn.scores.map((x) => `${p.rubric!.dimensions.find((d) => d.id === x.dimensionId)!.name} ${x.score}/4 verified=${x.verified}`).join("; "));
  console.log("improve:", turn.improve);
  console.log("next:", p.interviews[0].pending?.question);
  writeFileSync(join(ROOT, "lib", "seeds", "arjun-interview.json"), JSON.stringify({ rubric: p.rubric, interviews: p.interviews }, null, 2) + "\n");
  console.log("saved lib/seeds/arjun-interview.json");
})();
