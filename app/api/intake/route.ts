import { runAgent } from "@/lib/llm/agent";
import { IntakeResultSchema } from "@/lib/schemas/intake";

export const maxDuration = 60;

const SYSTEM = `You are the intake agent of a career-pivot coach. The user spoke (dictated) their story; the text is natural speech with filler words, restarts and rambling.
Turn it into clean structured data about THIS person. It could be any career pivot in any country.

Rules:
- Use only what the speaker said. Never invent employers, numbers, dates or skills. If something is not said, use "" (or 0 / []), and list it in "missing".
- Clean the speech: drop filler ("uh", "like", "you know"), fix grammar, but keep the speaker's meaning and voice. "motivation" should be 1-2 sentences in the speaker's own words, first person.
- timelineWeeks: convert what they say ("six months" = 26, "three months" = 12, "a year" = 52). If unstated use 26. hoursPerWeek: if unstated use 8.
- Keep currency, cities and company names exactly as spoken; do not assume any country.
- strengths: up to 5 short phrases supported by the story. fears: up to 5 short phrases of worries they voiced.
- experience: one entry per role mentioned, most recent first. achievements only if described. toolsUsed only if named.
- constraints: other practical limits they mentioned (job, family, health), as short phrases.
- salaryFloor: ONLY if they state a minimum pay as a number. amount in whole currency units for the period, currency as a code or symbol they used (INR, GBP, KES...), period "year" or "month". Omit the field if not stated. Never guess.
- cities: places they would be willing to work, as spoken; include "Remote" if they say remote is fine. [] if not said.
- alternateRoles: other roles they say they would also consider, [] if none.
- summary: 2 sentences, third person. Use the person's name or "they"; never guess gender from a name or job.
- missing: up to 5 short questions a coach would ask next (e.g. "What kind of company do you want to join?"). Empty if nothing important is missing.

Return ONLY JSON with exactly this shape:
{"person":{"name":"","location":"","yearsExperience":0,"currentRole":"","currentIndustry":"","education":""},
"goal":{"targetRole":"","targetIndustry":"","timelineWeeks":26,"hoursPerWeek":8,"salaryFloor":{"amount":0,"currency":"","period":"year"},"cities":[],"alternateRoles":[],"motivation":"","constraints":[]},
"summary":"","strengths":[],"fears":[],
"experience":[{"role":"","org":"","period":"","achievements":[],"toolsUsed":[]}],
"missing":[]}`;

export async function POST(req: Request) {
  let transcript = "";
  try {
    const body = await req.json();
    transcript = String(body?.transcript ?? "").trim();
  } catch {
    return new Response("Send JSON with a transcript.", { status: 400 });
  }
  if (transcript.length < 40) {
    return new Response("Tell me a bit more first: who you are, where you work now and where you want to go.", { status: 400 });
  }
  try {
    const result = await runAgent({
      schema: IntakeResultSchema,
      system: SYSTEM,
      input: transcript.slice(0, 8000),
    });
    return Response.json(result);
  } catch (e) {
    return new Response((e as Error).message || "The coach could not read that.", { status: 502 });
  }
}
