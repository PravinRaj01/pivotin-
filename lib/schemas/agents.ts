import { z } from "zod";

const strs = z.array(z.string()).catch([]);
const n = (d: number) => z.coerce.number().catch(d);

export const ProjectsResultSchema = z.object({
  projects: z
    .array(
      z.object({
        title: z.string(),
        pitch: z.string().catch(""),
        closesGaps: strs, // 2 or 3 skill ids
        oldFieldAngle: z.string().catch(""),
        interviewStory: z.string().catch(""),
        deliverable: z.string().catch(""),
        milestones: z.array(z.string()).catch([]), // titles, in order; the last is the deliverable
      }),
    )
    .catch([]),
});
export type ProjectsResult = z.infer<typeof ProjectsResultSchema>;

export const SequenceResultSchema = z.object({
  dependsOn: z.array(z.object({ skillId: z.string(), prerequisites: strs })).catch([]),
});
export type SequenceResult = z.infer<typeof SequenceResultSchema>;

export const PlanWeeksResultSchema = z.object({
  weeks: z
    .array(
      z.object({
        n: z.coerce.number(),
        theme: z.string().catch(""),
        tasks: z
          .array(
            z.object({
              title: z.string(),
              slot: z.string(), // a skillId from that week's slots, or "milestone", "wrap" or "practice"
              hours: z.coerce.number().min(0.5).max(12).catch(1),
              resourceId: z.string().nullable().optional().catch(null), // only ever an id from the supplied list
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});
export type PlanWeeksResult = z.infer<typeof PlanWeeksResultSchema>;

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
