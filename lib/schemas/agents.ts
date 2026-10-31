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

export const RubricResultSchema = z.object({
  dimensions: z
    .array(
      z.object({
        id: z.string().catch(""),
        name: z.string(),
        what: z.string().catch(""),
        levels: z.array(z.string()).catch([]), // exactly 4 lines, for scores 1 to 4
        skillIds: strs,
      }),
    )
    .catch([]),
});
export type RubricResult = z.infer<typeof RubricResultSchema>;

export const InterviewTurnResultSchema = z.object({
  scores: z
    .array(
      z.object({
        dimension: z.string(), // a rubric dimension id
        score: z.coerce.number().min(1).max(4).catch(1),
        quote: z.string().catch(""), // word for word from the answer
        why: z.string().catch(""),
      }),
    )
    .catch([]),
  improve: z.string().catch(""),
  nextQuestion: z.string().catch(""),
});
export type InterviewTurnResult = z.infer<typeof InterviewTurnResultSchema>;

export const CheckinResultSchema = z.object({
  hoursSpent: n(0), // hours they say they worked on the plan this week; 0 when they did not say
  completedTaskIds: strs,
  skippedTaskIds: strs, // tasks they said they skipped or did not do
  blockers: strs, // what got in the way
  mood: z.coerce.number().min(1).max(5).catch(3),
  wins: strs,
  notes: z.string().catch(""),
  hoursPerWeekFromNow: n(0), // a lasting change in the hours they have each week; 0 when nothing lasting changed
  coachMessage: z.string().catch(""),
});
export type CheckinResult = z.infer<typeof CheckinResultSchema>;

export const ApplicationLogSchema = z.object({
  action: z.enum(["add", "update"]).catch("add"), // a new application, or news about one already in the tracker
  company: z.string().catch(""),
  role: z.string().catch(""),
  roleFamily: z.string().catch(""),
  companyStage: z.string().catch(""),
  industry: z.string().catch(""),
  channel: z.string().catch(""),
  resumeVersion: z.string().catch(""),
  status: z.string().catch(""),
  appliedOn: z.string().catch(""), // YYYY-MM-DD
  location: z.string().catch(""),
  notes: z.string().catch(""),
  inferred: z.array(z.string()).catch([]), // which of companyStage, industry, roleFamily were not said but filled from general knowledge
});
export type ApplicationLogResult = z.infer<typeof ApplicationLogSchema>;

export const ApplicationInsightSchema = z.object({
  headline: z.string().catch(""),
  findings: z.array(z.object({ patternId: z.string(), text: z.string() })).catch([]),
  suggestions: z
    .array(z.object({ kind: z.enum(["target-role", "plan", "other"]).catch("other"), text: z.string(), role: z.string().optional().catch(undefined), patternId: z.string() }))
    .catch([]),
  caveat: z.string().catch(""),
});
export type ApplicationInsightResult = z.infer<typeof ApplicationInsightSchema>;
