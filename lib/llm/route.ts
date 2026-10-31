import { z } from "zod";
import { runAgent } from "./agent";

// One place for what every agent route does: parse JSON, check the input, call the model,
// validate the output with Zod, and answer with JSON or a short plain-text error.
export function agentRoute<T extends z.ZodTypeAny>(opts: {
  schema: T;
  system: string;
  check?: (input: Record<string, unknown>) => string | null; // return an error message to reject
  after?: (result: z.infer<T>, input: Record<string, unknown>) => string | null;
}) {
  return async function POST(req: Request) {
    let input: Record<string, unknown>;
    try {
      input = await req.json();
    } catch {
      return new Response("Send a JSON body.", { status: 400 });
    }
    const bad = opts.check?.(input);
    if (bad) return new Response(bad, { status: 400 });
    try {
      const result = await runAgent({ schema: opts.schema, system: opts.system, input });
      const problem = opts.after?.(result, input);
      if (problem) return new Response(problem, { status: 422 });
      return Response.json(result);
    } catch (e) {
      return new Response((e as Error).message || "The agent failed.", { status: 502 });
    }
  };
}
