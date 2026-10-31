// The only file that talks to an LLM. Server-side only (reads env keys).
// Swap providers with LLM_PROVIDER=gemini|openrouter; each adapter takes the same input.

export type LlmRequest = { system: string; user: string; json?: boolean };

type Adapter = (req: LlmRequest) => Promise<string>;

class RateLimitError extends Error {
  constructor(public retryAfterMs?: number) {
    super("rate limited");
  }
}

const gemini: Adapter = async ({ system, user, json }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.4,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (res.status === 429 || res.status >= 500) {
    const ra = Number(res.headers.get("retry-after"));
    throw new RateLimitError(ra ? ra * 1000 : undefined);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no text");
  return text;
};

const openrouter: Adapter = async ({ system, user, json }) => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429 || res.status >= 500) throw new RateLimitError();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned no text");
  return text;
};

const adapters: Record<string, Adapter> = { gemini, openrouter };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One call at a time with a small gap, so a burst of clicks cannot trip free-tier limits.
let chain: Promise<unknown> = Promise.resolve();
const GAP_MS = 400;

export function callLlm(req: LlmRequest, attempts = 4): Promise<string> {
  const adapter = adapters[process.env.LLM_PROVIDER || "gemini"] ?? gemini;
  const run = async () => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await adapter(req);
      } catch (e) {
        lastErr = e;
        if (!(e instanceof RateLimitError) && i >= 1) break;
        const base = e instanceof RateLimitError && e.retryAfterMs ? e.retryAfterMs : 1000 * 2 ** i;
        await sleep(Math.min(base, 15000) + Math.random() * 400);
      }
    }
    throw lastErr;
  };
  const next = chain.then(run, run).finally(() => sleep(GAP_MS));
  chain = next.catch(() => undefined);
  return next;
}
