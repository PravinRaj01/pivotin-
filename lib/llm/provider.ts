// The only file that talks to an LLM. Server-side only (reads env keys).
// Swap providers with LLM_PROVIDER=gemini|openrouter; each adapter takes the same input.

export type LlmRequest = { system: string; user: string; json?: boolean };

type Adapter = (req: LlmRequest) => Promise<string>;

class RateLimitError extends Error {
  constructor(public retryAfterMs?: number) {
    super("rate limited");
  }
}

// Every model is out of daily quota. Retrying will not help, so callLlm does not.
export class QuotaExhaustedError extends Error {
  constructor() {
    super("Today's free AI quota is used up on every available model. It resets within a day. Open a preloaded example, or try again later.");
  }
}

// The free tier gives each model its own small daily quota, so we walk a chain of models and
// skip the ones that are used up. Override the list with GEMINI_MODELS (comma separated).
const DEFAULT_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
];
const geminiModels = () => {
  const list = (process.env.GEMINI_MODELS || "").split(",").map((m) => m.trim()).filter(Boolean);
  const first = process.env.GEMINI_MODEL?.trim();
  const base = list.length ? list : DEFAULT_MODELS;
  return first ? [first, ...base.filter((m) => m !== first)] : base;
};

// model -> time (ms) until which it is skipped. Lives for the life of the server instance.
const skipUntil = new Map<string, number>();

function retryDelayMs(body: string): number {
  const m = body.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (!m) return 6 * 3600_000;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

const gemini: Adapter = async ({ system, user, json }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.4,
      thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING || "low" },
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });

  let busy: RateLimitError | null = null;
  let tried = 0;
  for (const model of geminiModels()) {
    if ((skipUntil.get(model) ?? 0) > Date.now()) continue;
    tried++;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(75000),
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (text) return text;
      continue; // empty answer (for example blocked); try the next model
    }
    const errText = await res.text().catch(() => "");
    if (res.status === 404) {
      skipUntil.set(model, Date.now() + 24 * 3600_000); // retired or not available to this key
    } else if (res.status === 429 && /PerDay/i.test(errText)) {
      skipUntil.set(model, Date.now() + retryDelayMs(errText)); // daily quota used up
      console.warn(`[llm] ${model} daily quota used up; moving on`);
    } else if (res.status === 429 || res.status >= 500) {
      busy = new RateLimitError(Number(res.headers.get("retry-after")) * 1000 || undefined); // per-minute limit or overloaded
    } else {
      throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
    }
  }
  if (busy) throw busy; // some model was only busy; callLlm backs off and tries the chain again
  if (!tried) throw new QuotaExhaustedError();
  throw new Error("Gemini returned no text");
};

const openrouter: Adapter = async ({ system, user, json }) => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(75000),
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
const GAP_MS = 1500;
// Free tiers limit requests per minute, so rate-limit retries wait longer than ordinary errors.
const RATE_WAITS = [3000, 8000, 15000, 20000];

export function callLlm(req: LlmRequest, attempts = 4): Promise<string> {
  const adapter = adapters[process.env.LLM_PROVIDER || "gemini"] ?? gemini;
  const run = async () => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await adapter(req);
      } catch (e) {
        lastErr = e;
        console.warn(`[llm] attempt ${i + 1}/${attempts} failed:`, (e as Error).message);
        if (e instanceof QuotaExhaustedError || (!(e instanceof RateLimitError) && i >= 1) || i === attempts - 1) break;
        const base = e instanceof RateLimitError ? Math.max(e.retryAfterMs ?? 0, RATE_WAITS[Math.min(i, 3)]) : 1000 * 2 ** i;
        await sleep(Math.min(base, 25000) + Math.random() * 500);
      }
    }
    throw lastErr;
  };
  const next = chain.then(run, run).finally(() => sleep(GAP_MS));
  chain = next.catch(() => undefined);
  return next;
}
