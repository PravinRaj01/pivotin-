import { runAgent } from "@/lib/llm/agent";
import { BridgeResultSchema } from "@/lib/schemas/jd";

export const maxDuration = 60;

const SYSTEM = `You are the skill-bridge agent of a career-pivot coach. Given a person's background and the skills their target role requires, you rate where they are today against what the role needs. Any career, any country.

For EVERY requirement in the input, return one entry using its exact "skillId".

Scale (current and required, 0 to 5, halves allowed):
0 none, 1 aware but no practice, 2 basic or adjacent experience, 3 working level, 4 strong, 5 expert.
- current: be honest and conservative. Rate only from evidence in the background (roles, achievements, tools, strengths, their own words). Do not inflate to be encouraging. No evidence = 0 to 1.
- required: what this target role asks of someone at the entry point the person is aiming for. Entry roles rarely need above 4. Raise it with higher "importance" and "frequency" in the requirement.
- evidence: up to 3 short phrases taken from or clearly supported by the background that justify "current". Use [] when there is none. Never invent achievements.
- previousRatings: if a skill has a previous rating, keep "current" within 0.5 of it and keep its evidence unless the background itself has new information. Only the requirements may have changed, not the person.
- Look for transferable evidence: skills from the current job often apply to the new role under different names.

Return ONLY JSON: {"skills":[{"skillId":"","current":0,"required":0,"evidence":[]}]}`;

export async function POST(req: Request) {
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return new Response("Send JSON with the profile.", { status: 400 });
  }
  try {
    const result = await runAgent({ schema: BridgeResultSchema, system: SYSTEM, input });
    if (!result.skills.length) return new Response("I could not rate the skills. Try again.", { status: 422 });
    return Response.json(result);
  } catch (e) {
    return new Response((e as Error).message || "Could not build the skill map.", { status: 502 });
  }
}
