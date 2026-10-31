// npm run seed:arjun
// Reads the 8 private job descriptions in seeds/jds (never committed), runs the JD agent on each one,
// counts how many of them ask for each skill, then runs the bridge agent on Arjun's profile.
// Only the derived analysis is saved (lib/seeds/arjun-analysis.json): skill names, counts and Arjun's
// columns. The job description text itself stays in seeds/.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyBridge, bandOf, bridgeInput, mergeJd } from "../lib/bridge";
import { arjun } from "../lib/seeds/arjun";
import type { BridgeResult, JdResult } from "../lib/schemas/jd";

const ROOT = join(__dirname, "..");
process.loadEnvFile(join(ROOT, ".env.local"));
// Use the larger free quota for this bulk run so the Gemini daily budget is kept for the demo.
// BRIDGE_ONLY=1 keeps the saved job description counts and re-rates with whatever LLM_PROVIDER says (default gemini).
if (process.env.GROQ_API_KEY && !process.env.BRIDGE_ONLY) process.env.LLM_PROVIDER = "groq";

// Same ids as the application tracker seed (j1..j8).
const FILES = [
  "meesho-product-manager-i.txt",
  "paytm-product-analyst-telco.txt",
  "paytm-product-manager-ii-travel.txt",
  "okta-product-manager-product-platform.txt",
  "groww-associate-product-manager.txt",
  "swiggy-associate-product-manager.txt",
  "razorpay-curlec-associate-product-manager.txt",
  "urban-company-associate-product-manager.txt",
];

async function post<T>(route: "jd" | "bridge", body: unknown): Promise<T> {
  const mod = await import(`../app/api/${route}/route`);
  const res = await mod.POST(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(body) }));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  // Start from Arjun's own skill labels so the plan keeps pointing at the same skill ids.
  let p = structuredClone(arjun);
  p.skills = [];
  p.targetRole = {
    jds: [],
    requirements: arjun.targetRole.requirements.map((r) => ({ ...r, sourceJdIds: [], frequency: 0, targetWording: undefined })),
  };

  const saved = JSON.parse(readFileSync(join(ROOT, "lib", "seeds", "arjun-analysis.json"), "utf8"));
  const bridgeOnly = !!process.env.BRIDGE_ONLY && saved.requirements?.length;
  if (bridgeOnly) {
    p.targetRole = { jds: arjun.targetRole.jds, requirements: saved.requirements };
    console.log("re-rating only: keeping the saved job description analysis");
  }

  for (const [i, file] of bridgeOnly ? [] : FILES.entries()) {
    const raw = readFileSync(join(ROOT, "seeds", "jds", file), "utf8");
    const text = raw.split("-----").slice(1).join("-----").trim();
    const jd = await post<JdResult>("jd", { text, roleHint: p.goal.targetRole, existing: p.targetRole.requirements.map((r) => r.label) });
    p = mergeJd(p, jd, "", `j${i + 1}`).profile;
    console.log(`j${i + 1} ${file}: ${jd.requirements.length} skills`);
  }

  // Skills no job description asked for do not belong in the map.
  p.targetRole.requirements = p.targetRole.requirements.filter((r) => r.sourceJdIds.length > 0);

  const bridge = await post<BridgeResult>("bridge", bridgeInput(p));
  p = applyBridge(p, bridge);

  const total = p.targetRole.jds.length;
  console.log(`\n${p.targetRole.requirements.length} skills across ${total} job descriptions\n`);
  for (const r of [...p.targetRole.requirements].sort((a, b) => b.sourceJdIds.length - a.sourceJdIds.length)) {
    const s = p.skills.find((x) => x.id === r.skillId)!;
    console.log(`${String(r.sourceJdIds.length).padStart(2)}/${total} ${bandOf(r.frequency).padEnd(9)} ${s.status.padEnd(12)} L${s.current}/${s.required} ${s.evidenceVerified === false ? "(quote NOT verbatim) " : ""}${r.label}`);
  }
  const claimed = p.skills.filter((s) => s.status !== "missing");
  console.log(`\nquotes found word for word: ${claimed.filter((s) => s.evidenceVerified).length} of ${claimed.length}`);

  writeFileSync(
    join(ROOT, "lib", "seeds", "arjun-analysis.json"),
    JSON.stringify({ requirements: p.targetRole.requirements, skills: p.skills }, null, 2) + "\n",
  );
  console.log("saved lib/seeds/arjun-analysis.json");
})();
