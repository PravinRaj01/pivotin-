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
  dependsOn: z.array(z.string()).optional(), // skill ids a learner should have first
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
  // Learning links only ever come from data/resources.json. noResource means that list has nothing for this skill.
  resourceId: z.string().optional(),
  noResource: z.boolean().optional(),
  kind: z.enum(["learn", "milestone", "wrap"]).default("learn"),
  projectId: z.string().optional(),
  milestoneIdx: z.number().optional(),
  movedTo: z.number().optional(), // status "moved": the week this task was carried to at a check-in
  carriedFrom: z.number().optional(), // a copy of a task that was carried here from an earlier week
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
      z.object({
        n: z.number(),
        theme: z.string(),
        hours: z.number(),
        tasks: z.array(TaskSchema),
        block: z.number().optional(), // weeks come in blocks of 2 or 3; each block ends with a project milestone
        blockEnd: z.boolean().optional(),
        wrap: z.boolean().optional(), // closing weeks: interviews and applications
      }),
    ),
    uncovered: z.array(z.string()).default([]), // skill ids that did not fit in the time available
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
      oldFieldAngle: z.string().default(""), // how it draws on their previous field
      interviewStory: z.string().default(""), // the story they will be able to tell, blanks where results are not in yet
      milestones: z.array(z.object({ title: z.string(), done: z.boolean(), week: z.number().optional(), hours: z.number().optional() })),
      status: z.enum(["suggested", "active", "done"]),
      link: z.string().optional(),
    }),
  ),

  // Written by the rubric agent for this target role; never a fixed template.
  rubric: z
    .object({
      key: z.string(), // role + the main skills it was written from; a change means the rubric is out of date
      role: z.string(),
      createdAt: z.string(),
      dimensions: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          what: z.string(),
          levels: z.array(z.string()).length(4), // what an answer scoring 1, 2, 3 and 4 sounds like
          skillIds: z.array(z.string()), // profile skills this dimension is evidence for
        }),
      ),
    })
    .optional(),

  interviews: z.array(
    z.object({
      id,
      startedAt: z.string(),
      finishedAt: z.string().optional(),
      pending: z.object({ question: z.string(), kind: z.enum(["switch", "followup", "role"]), dimensionId: z.string().optional() }).nullable().default(null),
      turns: z.array(
        z.object({
          question: z.string(),
          kind: z.enum(["switch", "followup", "role"]),
          dimensionId: z.string().optional(),
          answer: z.string(),
          scores: z.array(z.object({ dimensionId: z.string(), score: z.number().min(1).max(4), quote: z.string(), verified: z.boolean(), why: z.string() })),
          improve: z.string(),
          skillChanges: z.array(z.object({ skillId: z.string(), from: z.number(), to: z.number() })),
        }),
      ),
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
        skippedTaskIds: z.array(z.string()).default([]),
        plannedHours: z.number().optional(), // what the week asked for, to compare with hoursSpent
        hoursPerWeekFromNow: z.number().optional(), // a lasting change in the hours they have, if they said so
        coachMessage: z.string().optional(),
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
      // applied -> response -> interview -> offer, or rejected. "saved" is a role you have not applied to yet.
      status: z.enum(["saved", "applied", "response", "interview", "offer", "rejected"]),
      dates: z.object({ applied: z.string().optional(), nextStep: z.string().optional() }),
      // Fit comes from the bridge map. A job description linked here (jdId) or pasted at logging gives a role-specific
      // score; otherwise it is the overall map. fitScore is only stored for a pasted job description.
      fitScore: z.number().optional(),
      fitBasis: z.enum(["job description", "overall map"]).optional(),
      roleFamily: z.string().default(""), // the kind of role, worded the same for similar roles
      companyStage: z.string().default(""),
      industry: z.string().default(""),
      channel: z.string().default(""), // Referral, Careers page, Job board, Recruiter, Event or Other
      resumeVersion: z.string().default(""),
      inferred: z.array(z.string()).default([]), // fields the agent filled from general knowledge, not from what was said
      notes: z.string(),
      followUps: z.array(z.string()),
      location: z.string().optional(),
      source: z.string().optional(),
    }),
  ),

  // What the application analyst said about the patterns in the tracker, and the exact counts it was based on.
  applicationInsights: z
    .object({
      key: z.string(),
      createdAt: z.string(),
      headline: z.string(),
      findings: z.array(z.object({ patternId: z.string(), text: z.string() })),
      suggestions: z.array(z.object({ kind: z.enum(["target-role", "plan", "other"]), text: z.string(), role: z.string().optional(), patternId: z.string() })),
      caveat: z.string(),
    })
    .optional(),

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
    plan: { generatedAt: "", revision: 0, weeks: [], uncovered: [], changelog: [] },
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
