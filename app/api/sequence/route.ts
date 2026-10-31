import { agentRoute } from "@/lib/llm/route";
import { SequenceResultSchema } from "@/lib/schemas/agents";

export const maxDuration = 60;

const SYSTEM = `You are the prerequisite agent of a career-pivot coach. Given a list of skills a person needs to learn for their target role, you say which skills should be learned before others. Any career, any country. You work only from the list you are given.

Input: targetRole, skills (each with skillId, label, category).

Rules:
- For each skill, list in "prerequisites" the OTHER skills from the same list that a learner should have at least a basic grasp of before starting it, because the later skill uses or builds on them. Use skillIds only.
- Only real dependencies. If a skill can be learned on its own, give an empty list. Do not link skills just because they are related. Most skills have 0 or 1 prerequisite; never more than 2.
- Never make a skill depend on itself and never create a loop (if A needs B then B must not need A).
- Return an entry for every skill in the input.

Return ONLY JSON: {"dependsOn":[{"skillId":"","prerequisites":[""]}]}`;

export const POST = agentRoute({
  schema: SequenceResultSchema,
  system: SYSTEM,
  check: (i) => (!Array.isArray(i.skills) || !i.skills.length ? "No skills to order." : null),
});
