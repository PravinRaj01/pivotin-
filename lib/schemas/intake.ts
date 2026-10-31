import { z } from "zod";

// Lenient on purpose: speech is messy, so every field has a safe default and numbers are coerced.
const str = z.string().default("");
const num = (d: number) => z.coerce.number().catch(d);
const list = z.array(z.string()).catch([]);

export const IntakeResultSchema = z.object({
  person: z.object({
    name: str,
    location: str,
    yearsExperience: num(0),
    currentRole: str,
    currentIndustry: str,
    education: str.optional(),
  }),
  goal: z.object({
    targetRole: str,
    targetIndustry: str.optional(),
    timelineWeeks: num(26),
    hoursPerWeek: num(8),
    motivation: str,
    constraints: list,
  }),
  summary: str,
  strengths: list,
  fears: list,
  experience: z
    .array(
      z.object({
        role: str,
        org: str,
        period: str,
        achievements: list,
        toolsUsed: list,
      }),
    )
    .catch([]),
  // Things a coach would still want to know that the speaker did not say.
  missing: list,
});

export type IntakeResult = z.infer<typeof IntakeResultSchema>;
