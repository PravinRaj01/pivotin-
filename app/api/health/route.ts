import { callLlm } from "@/lib/llm/provider";

// GET /api/health          -> which provider is configured (no model call, no quota used)
// GET /api/health?live=1   -> also sends one tiny request to the model
export async function GET(req: Request) {
  const provider = process.env.LLM_PROVIDER || "gemini";
  const configured = provider === "openrouter" ? !!process.env.OPENROUTER_API_KEY : !!process.env.GEMINI_API_KEY;
  if (!new URL(req.url).searchParams.get("live")) return Response.json({ ok: configured, provider, configured });
  try {
    const text = await callLlm({ system: "Reply with the single word: ok", user: "ping" }, 2);
    return Response.json({ ok: true, provider, reply: text.trim().slice(0, 20) });
  } catch (e) {
    return Response.json({ ok: false, provider, error: (e as Error).message }, { status: 502 });
  }
}
