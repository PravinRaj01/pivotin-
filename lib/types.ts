import { z } from "zod";

// The Pivot Profile: the one shared object every screen reads and every agent writes.
// Nothing here knows about a specific career; roles, skills and tasks are all data.

const id = z.string();
// Skill levels: 0 none, 1 aware / basic, 2 working, 3 strong.
const level = z.number().min(0).max(3);

export const SkillSchema = z.object({
  id,
  label: z.string(),
  category: z.enum(["technical", "domain", "craft", "soft"]),
  current: level,
  required: level,
  evidence: z.array(z.string()),
  status: z.enum(["have", "transferable", "missing"]),
  // Transferable skills: how the person words it today, and how the target role words it.
  oldWording: z.string().optional(),
  targetWording: z.string().optional(),
  // True when every evidence quote was found word for word in their story, resume or work history.
  evidenceVerified: z.boolean().optional(),
  lastVerifiedAt: z.string().optional(),
});

export const TaskSchema = z.object({
  id,
  title: z.string(),
  skillIds: z.array(z.string()),
  estHours: z.number(),
  resourceHint: z.string().optional(),
  status: z.enum(["todo", "done", "skipped", "moved"]),
});

export const PivotProfileSchema = z.object({
  version: z.literal(1),
  id,
  createdAt: z.string(),
  updatedAt: z.string(),

  person: z.object({
    name: z.string(),
    location: z.string(),
    yearsExperience: z.number(),
    currentRole: z.string(),
    currentIndustry: z.string(),
    education: z.string().optional(),
    resume: z.string().optional(), // pasted resume text, used as evidence for the skill bridge
  }),

  goal: z.object({
    targetRole: z.string(),
    targetIndustry: z.string().optional(),
    timelineWeeks: z.number(),
    hoursPerWeek: z.number(),
    deadline: z.string().optional(), // ISO date the person wants to be hired by
    salaryFloor: z.object({ amount: z.number(), currency: z.string(), period: z.enum(["year", "month"]) }).optional(),
    cities: z.array(z.string()), // where they would work; empty means anywhere / remote
    alternateRoles: z.array(z.string()),
    motivation: z.string(),
    constraints: z.array(z.string()), // anything else, in their words
  }),

  story: z.object({
    rawTranscripts: z.array(z.object({ id, at: z.string(), text: z.string() })),
    summary: z.string(),
    strengths: z.array(z.string()),
    fears: z.array(z.string()),
    // Side comments that say what they like or avoid, kept so plans and projects can respect them.
    preferences: z.array(z.object({ text: z.string(), kind: z.enum(["dislike", "like", "value", "limit", "other"]) })).default([]),
    // Where the speaker changed their mind; only the final value is kept in the profile.
    corrections: z.array(z.object({ topic: z.string(), was: z.string(), now: z.string() })).default([]),
    // Open items from the last intake: options when the target role is unknown, and one follow-up question.
    roleSuggestions: z
      .array(z.object({ title: z.string(), why: z.string(), distance: z.enum(["close", "stretch", "leap"]) }))
      .default([]),
    followUp: z.object({ field: z.string(), question: z.string() }).nullable().default(null),
  }),

  experience: z.array(
    z.object({
      id,
      role: z.string(),
      org: z.string(),
      period: z.string(),
      achievements: z.array(z.string()),
      toolsUsed: z.array(z.string()),
    }),
  ),

  targetRole: z.object({
    jds: z.array(
      z.object({ id, title: z.string(), company: z.string(), rawText: z.string(), addedAt: z.string() }),
    ),
    requirements: z.array(
      z.object({
        skillId: z.string(),
        label: z.string(),
        category: z.enum(["technical", "domain", "craft", "soft"]),
        importance: z.number().min(1).max(5),
        frequency: z.number().min(0).max(1),
        sourceJdIds: z.array(z.string()),
        targetWording: z.string().optional(), // the employers' own phrase for this skill
      }),
    ),
  }),

  skills: z.array(SkillSchema),

  plan: z.object({
    generatedAt: z.string(),
    revision: z.number(),
    weeks: z.array(
      z.object({ n: z.number(), theme: z.string(), hours: z.number(), tasks: z.array(TaskSchema) }),
    ),
    changelog: z.array(z.object({ at: z.string(), reason: z.string(), summary: z.string() })),
  }),

  projects: z.array(
    z.object({
      id,
      title: z.string(),
      pitch: z.string(),
      skillIds: z.array(z.string()),
      deliverable: z.string(),
      scopeHours: z.number(),
      milestones: z.array(z.object({ title: z.string(), done: z.boolean() })),
      status: z.enum(["suggested", "active", "done"]),
      link: z.string().optional(),
    }),
  ),

  interviews: z.array(
    z.object({
      id,
      kind: z.enum(["behavioral", "role-specific", "case"]),
      startedAt: z.string(),
      turns: z.array(
        z.object({
          question: z.string(),
          answerTranscript: z.string(),
          feedback: z.string(),
          scores: z.object({ clarity: z.number(), structure: z.number(), evidence: z.number() }),
        }),
      ),
      skillSignals: z.array(z.object({ skillId: z.string(), delta: z.number() })),
    }),
  ),

  checkins: z.array(
    z.object({
      id,
      weekN: z.number(),
      at: z.string(),
      transcript: z.string(),
      parsed: z.object({
        hoursSpent: z.number(),
        completedTaskIds: z.array(z.string()),
        blockers: z.array(z.string()),
        mood: z.number().min(1).max(5),
        wins: z.array(z.string()),
        notes: z.string(),
      }),
      planAdjustments: z.array(z.string()),
    }),
  ),

  applications: z.array(
    z.object({
      id,
      company: z.string(),
      role: z.string(),
      jdId: z.string().optional(),
      status: z.enum(["saved", "applied", "screen", "interview", "offer", "rejected"]),
      dates: z.object({ applied: z.string().optional(), nextStep: z.string().optional() }),
      fitScore: z.number().optional(),
      notes: z.string(),
      followUps: z.array(z.string()),
      location: z.string().optional(),
      source: z.string().optional(),
    }),
  ),

  settings: z.object({
    wisprProInstalled: z.boolean(),
    personaId: z.string().optional(),
  }),
});

export type PivotProfile = z.infer<typeof PivotProfileSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Task = z.infer<typeof TaskSchema>;

// Time and id are arguments so the first (server) render can use fixed values.
export function emptyProfile(
  now: string = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): PivotProfile {
  return {
    version: 1,
    id,
    createdAt: now,
    updatedAt: now,
    person: { name: "", location: "", yearsExperience: 0, currentRole: "", currentIndustry: "" },
    goal: { targetRole: "", timelineWeeks: 0, hoursPerWeek: 0, cities: [], alternateRoles: [], motivation: "", constraints: [] },
    story: { rawTranscripts: [], summary: "", strengths: [], fears: [], preferences: [], corrections: [], roleSuggestions: [], followUp: null },
    experience: [],
    targetRole: { jds: [], requirements: [] },
    skills: [],
    plan: { generatedAt: "", revision: 0, weeks: [], changelog: [] },
    projects: [],
    interviews: [],
    checkins: [],
    applications: [],
    settings: { wisprProInstalled: false },
  };
}

// Derived, never stored.
export function readiness(p: PivotProfile): number {
  const need = p.skills.reduce((s, k) => s + k.required, 0);
  if (!need) return 0;
  const have = p.skills.reduce((s, k) => s + Math.min(k.current, k.required), 0);
  return Math.round((have / need) * 100);
}
