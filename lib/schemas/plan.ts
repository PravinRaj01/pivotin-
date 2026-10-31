import { z } from "zod";

export const PlanResultSchema = z.object({
  summary: z.string().catch(""),
  weeks: z
    .array(
      z.object({
        n: z.coerce.number(),
        theme: z.string().catch(""),
        tasks: z
          .array(
            z.object({
              title: z.string(),
              skillIds: z.array(z.string()).catch([]),
              estHours: z.coerce.number().min(0.5).max(12).catch(2),
              resourceHint: z.string().optional().catch(undefined),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;
