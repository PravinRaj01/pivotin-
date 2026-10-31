import { runAgent } from "@/lib/llm/agent";
import { PlanResultSchema } from "@/lib/schemas/plan";

export const maxDuration = 300;

const SYSTEM = `You are the planning agent of a career-pivot coach. You write a week-by-week study-and-action plan for ONE person switching careers. Any career, any country.

Input fields: goal (targetRole, totalWeeks, hoursPerWeek, constraints), skills (with skillId, current, required, status), projectIdeas, alreadyDone, fromWeek, weeksToWrite, reason.

Write exactly "weeksToWrite" weeks, numbered fromWeek to totalWeeks, with no gaps.

How to plan:
- Order: foundations of the biggest gaps first; then practice and proof of work (a portfolio project, using projectIdeas if given); then interview preparation; then applications and review in the last weeks. Spread the work so no week is a copy of the last.
- Spend time in proportion to the gap (required minus current) and the skill's importance. Do not spend time on skills where status is "have", except to show them off.
- Each week: a short "theme" (2-5 words) and 2 to 4 tasks. The sum of estHours in a week must be at most hoursPerWeek and close to it.
- Each task: a concrete action with a visible result ("Write a one-page PRD for a feature of an app you use"), not a topic ("Learn about PRDs"). estHours between 1 and 4, halves allowed. skillIds only from the input skills, 1-2 per task. resourceHint: a type of resource or search phrase ("free intro course on SQL window functions"), never a made-up URL, book or course title unless it is very well known.
- Respect constraints (e.g. only evenings, a full-time job). If "reason" describes a change (missed weeks, a blocker, a new job description), the plan must visibly respond to it.
- Do not repeat tasks listed in alreadyDone.
- "summary": 1-2 sentences saying what this plan focuses on or what changed and why, in plain words addressed to the person ("you").

Return ONLY JSON: {"summary":"","weeks":[{"n":1,"theme":"","tasks":[{"title":"","skillIds":[],"estHours":2,"resourceHint":""}]}]}`;

export async function POST(req: Request) {
  let input: { weeksToWrite?: number; skills?: unknown[] } | null = null;
  try {
    input = await req.json();
  } catch {
    return new Response("Send JSON with the plan input.", { status: 400 });
  }
  if (!input?.skills?.length) return new Response("Build your skill map first so the plan knows your gaps.", { status: 400 });
  const expected = Number(input.weeksToWrite ?? 0);
  try {
    const result = await runAgent({ schema: PlanResultSchema, system: SYSTEM, input });
    if (expected && result.weeks.length < Math.ceil(expected * 0.7)) {
      return new Response("The plan came back incomplete. Try again.", { status: 422 });
    }
    return Response.json(result);
  } catch (e) {
    return new Response((e as Error).message || "Could not build the plan.", { status: 502 });
  }
}
