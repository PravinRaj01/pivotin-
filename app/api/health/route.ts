import { callLlm } from "@/lib/llm/provider";

export async function GET() {
  try {
    const text = await callLlm({ system: "Reply with the single word: ok", user: "ping" }, 2);
    return Response.json({ ok: true, provider: process.env.LLM_PROVIDER || "gemini", reply: text.trim().slice(0, 20) });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
