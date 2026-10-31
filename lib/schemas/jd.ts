import { z } from "zod";

const category = z.enum(["technical", "domain", "craft", "soft"]).catch("craft");

export const JdResultSchema = z.object({
  title: z.string().catch(""),
  company: z.string().catch(""),
  requirements: z
    .array(
      z.object({
        label: z.string(),
        category,
        importance: z.coerce.number().min(1).max(5).catch(3),
      }),
    )
    .catch([]),
});
export type JdResult = z.infer<typeof JdResultSchema>;

export const BridgeResultSchema = z.object({
  skills: z
    .array(
      z.object({
        skillId: z.string(),
        current: z.coerce.number().min(0).max(5).catch(0),
        required: z.coerce.number().min(0).max(5).catch(3),
        evidence: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
});
export type BridgeResult = z.infer<typeof BridgeResultSchema>;
