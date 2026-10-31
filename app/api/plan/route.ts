import { agentRoute } from "@/lib/llm/route";
import { PlanWeeksResultSchema } from "@/lib/schemas/agents";

export const maxDuration = 120;

const SYSTEM = `You are the planning agent of a career-pivot coach. The schedule is already decided: which skills are worked on in which week, for how many hours, and which project milestone ends each block. Your job is only to write the tasks. Any career, any country.

Input: goal (targetRole, hoursPerWeek), preferences, projects, resources (a curated list), weeks. Each week has n, budgetHours, kind ("learn", "practice" or "wrap"), slots (skill work: slot = the skillId, skill = its name, hours, level "from->to" on a 0-3 scale, employerWording) and optionally a milestone (slot "milestone", project, milestone title, hours).

For EVERY week return a theme and tasks:
- theme: 2 to 5 words naming what the week is about.
- For each slot in the week write 1 or 2 tasks whose hours add up to that slot's hours. Set the task's "slot" to the slot's skillId exactly. A task is a concrete action with a visible result (something you could show someone, with a number or a named output), not a topic. Build on the previous weeks; do not repeat a task.
- For a "milestone" write one task with slot "milestone" that carries out that milestone for that project, using the project and milestone titles, and the milestone's hours. Name what exists at the end of it.
- Weeks of kind "practice" have no skill slots: write 1 or 2 tasks with slot "practice" that apply the recent skills to a small exercise. Weeks of kind "wrap" are the closing weeks: write 2 or 3 tasks with slot "wrap" for interview practice, polishing the portfolio and sending applications for the target role.
- The hours of all tasks in a week must not exceed budgetHours.

Learning resources:
- "resourceId" is an id from the resources list, or null. Use one ONLY when that resource directly teaches the task's skill. Never invent an id, a title or a link. If nothing in the list fits, use null: that is expected and correct. Give resources only to skill tasks, not to milestone, practice or wrap tasks.
- Do not reuse the same resource for more than 2 tasks in the whole input.

Respect preferences (things they like or dislike) when choosing how to practise.

Return ONLY JSON: {"weeks":[{"n":1,"theme":"","tasks":[{"title":"","slot":"","hours":2,"resourceId":null}]}]}`;

export const POST = agentRoute({
  schema: PlanWeeksResultSchema,
  system: SYSTEM,
  check: (i) => (!Array.isArray(i.weeks) || !i.weeks.length ? "There are no weeks to write." : null),
  after: (r) => (r.weeks.length ? null : "The plan came back empty. Try again."),
});
