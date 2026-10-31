import { z } from "zod";

const strs = z.array(z.string()).catch([]);
const n = (d: number) => z.coerce.number().catch(d);

export const ProjectsResultSchema = z.object({
  projects: z
    .array(
      z.object({
        title: z.string(),
        pitch: z.string().catch(""),
        skillIds: strs,
        deliverable: z.string().catch(""),
        scopeHours: n(20),
        milestones: strs,
      }),
    )
    .catch([]),
});
export type ProjectsResult = z.infer<typeof ProjectsResultSchema>;

export const InterviewResultSchema = z.object({
  feedback: z.string().catch(""), // on the latest answer; "" for the opening question
  scores: z
    .object({
      clarity: z.coerce.number().min(1).max(5).catch(3),
      structure: z.coerce.number().min(1).max(5).catch(3),
      evidence: z.coerce.number().min(1).max(5).catch(3),
    })
    .optional()
    .catch(undefined),
  skillSignals: z.array(z.object({ skillId: z.string(), delta: n(0) })).catch([]),
  nextQuestion: z.string().catch(""),
  done: z.boolean().catch(false),
});
export type InterviewResult = z.infer<typeof InterviewResultSchema>;

export const CheckinResultSchema = z.object({
  hoursSpent: n(0),
  completedTaskIds: strs,
  blockers: strs,
  mood: z.coerce.number().min(1).max(5).catch(3),
  wins: strs,
  notes: z.string().catch(""),
  skillSignals: z.array(z.object({ skillId: z.string(), delta: n(0) })).catch([]),
  replan: z.object({ needed: z.boolean().catch(false), reason: z.string().catch("") }).catch({ needed: false, reason: "" }),
  coachMessage: z.string().catch(""),
});
export type CheckinResult = z.infer<typeof CheckinResultSchema>;

export const ApplicationResultSchema = z.object({
  title: z.string().catch(""),
  company: z.string().catch(""),
  location: z.string().catch(""),
  fitScore: z.coerce.number().min(0).max(100).catch(50),
  strengths: strs,
  gaps: strs,
  followUps: strs,
  pitch: z.string().catch(""),
});
export type ApplicationResult = z.infer<typeof ApplicationResultSchema>;
