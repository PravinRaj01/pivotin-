import { z } from "zod";
import { callLlm } from "./provider";

// Every agent: one prompt in, JSON out, validated against a schema.
// A bad shape gets one repair retry; after that the caller falls back to the last good state.

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

export async function runAgent<T extends z.ZodTypeAny>(opts: {
  schema: T;
  system: string;
  input: unknown;
}): Promise<z.infer<T>> {
  const user = typeof opts.input === "string" ? opts.input : JSON.stringify(opts.input);
  let hint = "";
  for (let i = 0; i < 2; i++) {
    const text = await callLlm({ system: opts.system + hint, user, json: true });
    try {
      const parsed = opts.schema.safeParse(extractJson(text));
      if (!parsed.success) console.warn("[agent] failed validation:", parsed.error.message.slice(0, 200));
      if (parsed.success) return parsed.data;
      hint = `\n\nYour previous reply failed validation: ${parsed.error.message.slice(0, 400)}. Return only valid JSON matching the shape.`;
    } catch {
      console.warn("[agent] not valid JSON, starts with:", JSON.stringify(text.slice(0, 160)), "length", text.length);
      hint = "\n\nYour previous reply was not valid JSON. Return only a JSON object.";
    }
  }
  throw new Error("Agent returned invalid output twice");
}
