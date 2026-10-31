import { runAgent } from "@/lib/llm/agent";
import { JdResultSchema } from "@/lib/schemas/jd";

export const maxDuration = 60;

const SYSTEM = `You are the job-description agent of a career-pivot coach. You read ONE job description for any role in any industry and country, including roles you have never seen, and extract the skills the employer asks for.

Rules:
- If the text is a real job description, extract title and company as written (use "" if absent).
- If the text is only a role name or very short, set "title" to that role, company to "", and list the skills such a role typically needs, keeping to well-known expectations.
- requirements: every distinct skill the text asks for, usually 8 to 16. Do not leave one out because it is short; a skill that appears in the text must appear in your list. Each "label" is a short noun phrase of 2-5 words (a skill name a recruiter would recognise, not a sentence). Name each skill at the general level that any other employer hiring for the same role would also use, not a company-specific project, product or team detail. Merge duplicates and near-duplicates into one. Skip generic items such as degrees, years of experience, location, perks and visa status.
- "existing" lists skill labels already tracked for this person's target role. If a requirement is the same skill as an existing label, reuse that label EXACTLY. Only invent a new label when it is genuinely a different skill.
- category: "technical" (tools, code, data), "domain" (industry or business knowledge), "craft" (core professional methods of the role), "soft" (communication, collaboration, leadership).
- wording: the employer's own short phrase for this requirement, copied from the text (at most 12 words). For a role name with no description, a typical phrase for it.
- importance 1-5: 5 = must-have stated firmly or repeated, 3 = expected, 1 = nice to have.
- Use only what the text supports. Do not invent requirements the text does not suggest.

Return ONLY JSON: {"title":"","company":"","requirements":[{"label":"","category":"technical|domain|craft|soft","importance":3,"wording":""}]}`;

export async function POST(req: Request) {
  let text = "";
  let roleHint = "";
  let existing: string[] = [];
  try {
    const b = await req.json();
    text = String(b?.text ?? "").trim();
    roleHint = String(b?.roleHint ?? "").trim();
    existing = Array.isArray(b?.existing) ? b.existing.map(String).slice(0, 40) : [];
  } catch {
    return new Response("Send JSON with the job description text.", { status: 400 });
  }
  if (!text && !roleHint) return new Response("Paste a job description first.", { status: 400 });
  try {
    const result = await runAgent({
      schema: JdResultSchema,
      system: SYSTEM,
      input: { jobDescription: text ? text.slice(0, 12000) : `Role only, no description: ${roleHint}`, targetRole: roleHint, existing },
    });
    if (!result.requirements.length) return new Response("I could not find any skills in that text. Paste the full job description.", { status: 422 });
    return Response.json(result);
  } catch (e) {
    return new Response((e as Error).message || "Could not read that job description.", { status: 502 });
  }
}
