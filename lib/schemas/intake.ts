import { z } from "zod";

// Lenient on purpose: speech is messy, so every field has a safe default and numbers are coerced.
// 0 or "" always means "the speaker did not say". The app never fills those with a guess.
const str = z.string().default("");
const num = (d: number) => z.coerce.number().catch(d);
const list = z.array(z.string()).catch([]);

export const FOLLOW_UP_FIELDS = ["targetRole", "hoursPerWeek", "deadline", "currentRole", "salaryFloor", "location"] as const;

export const IntakeResultSchema = z.object({
  person: z.object({
    name: str,
    location: str, // city or area where they live now
    yearsExperience: num(0),
    currentRole: str,
    currentIndustry: str,
    education: str.optional(),
  }),
  goal: z.object({
    targetRole: str, // "" when they do not know yet
    targetIndustry: str.optional(),
    alternateRoles: list,
    timelineWeeks: num(0), // 0 = not said
    deadline: str, // YYYY-MM-DD, "" = not said
    hoursPerWeek: num(0), // 0 = not said
    salaryFloor: z
      .object({ amount: num(0), currency: str, period: z.enum(["year", "month"]).catch("year") })
      .optional()
      .catch(undefined),
    cities: list,
    motivation: str,
    constraints: list,
  }),
  summary: str,
  strengths: list,
  fears: list,
  // Side comments about what they like or avoid.
  preferences: z
    .array(z.object({ text: z.string(), kind: z.enum(["dislike", "like", "value", "limit", "other"]).catch("other") }))
    .catch([]),
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
  // Places where the speaker changed their mind or fixed a number; only the final value is used.
  corrections: z
    .array(z.object({ topic: z.string(), was: z.string(), now: z.string() }))
    .catch([]),
  // Only when targetRole is "": 2 to 3 options, closest to their background first.
  roleSuggestions: z
    .array(z.object({ title: z.string(), why: z.string().catch(""), distance: z.enum(["close", "stretch", "leap"]).catch("stretch") }))
    .catch([]),
  // At most one question, for the single most important thing still missing.
  followUp: z
    .object({ field: z.enum(FOLLOW_UP_FIELDS).catch("targetRole"), question: z.string() })
    .nullable()
    .optional()
    .catch(null),
});

export type IntakeResult = z.infer<typeof IntakeResultSchema>;
