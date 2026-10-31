// Browser-side wrapper for agent routes. Results are cached in localStorage by route + input,
// so clicking around never spends a free-tier request twice.

const PREFIX = "pivotin.cache.v4."; // bump when an agent output shape or scale changes

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function callAgent<T>(route: string, input: unknown, opts?: { fresh?: boolean }): Promise<T> {
  const body = JSON.stringify(input);
  const key = PREFIX + route + "." + hash(body);
  if (!opts?.fresh) {
    try {
      const hit = localStorage.getItem(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {}
  }
  const res = await fetch(`/api/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Request failed (${res.status})`);
  }
  const data = (await res.json()) as T;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
  return data;
}
