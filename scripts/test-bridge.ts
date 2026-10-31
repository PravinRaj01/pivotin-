// npm run test:bridge
// Part 1 (offline): the counting and the must-have / common / rare bands.
// Part 2 (live model calls, about 4 requests): a different field end to end. Hannah, a teacher moving to UX,
// with three UX job descriptions. Proves the agents read skills from the text rather than from a list.
import { join } from "node:path";
import { applyBridge, bandOf, bridgeInput, mergeJd, requiredFor } from "../lib/bridge";
import type { BridgeResult, JdResult } from "../lib/schemas/jd";
import { teacher } from "../lib/seeds/teacher";
import { emptyProfile } from "../lib/types";

process.loadEnvFile(join(__dirname, "..", ".env.local"));

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}

// ---------- Part 1: offline ----------
console.log("\nCounting and bands");
check("60% exactly is a must-have", bandOf(0.6) === "must-have", bandOf(0.6));
check("59% is only common", bandOf(0.59) === "common", bandOf(0.59));
check("30% exactly is common", bandOf(0.3) === "common", bandOf(0.3));
check("29% is rare", bandOf(0.29) === "rare", bandOf(0.29));
check("required level follows the band (3 / 2 / 1)", requiredFor(0.8) === 3 && requiredFor(0.4) === 2 && requiredFor(0.1) === 1);

const jd = (labels: string[]): JdResult => ({ title: "Role", company: "Co", requirements: labels.map((label) => ({ label, category: "craft", importance: 4, wording: `${label} wording` })) });
let p = emptyProfile("2026-01-01T00:00:00.000Z", "t");
// 5 JDs: "Alpha" in 4 of 5, "Beta" in 2 of 5, "Gamma" in 1 of 5. JD 2 spells Alpha with a look-alike hyphen and lists it twice.
const lists = [["Alpha skill", "Beta skill"], ["Alpha‑skill", "alpha skill", "Gamma skill"], ["Alpha skill", "Beta skill"], ["Alpha skill"], ["Delta skill"]];
lists.forEach((l, i) => (p = mergeJd(p, jd(l), "", `j${i + 1}`).profile));
const r = (label: string) => p.targetRole.requirements.find((x) => x.label.startsWith(label))!;
check("5 job descriptions recorded", p.targetRole.jds.length === 5, p.targetRole.jds.length);
check("look-alike hyphens and case match one skill", p.targetRole.requirements.filter((x) => /alpha/i.test(x.label)).length === 1, p.targetRole.requirements.map((x) => x.label));
check("a skill listed twice in one JD counts once", r("Alpha").sourceJdIds.filter((id) => id === "j2").length === 1);
check("Alpha is in 4 of 5 = 80% = must-have", r("Alpha").sourceJdIds.length === 4 && r("Alpha").frequency === 0.8 && bandOf(r("Alpha").frequency) === "must-have", r("Alpha").frequency);
check("Beta is in 2 of 5 = 40% = common", r("Beta").frequency === 0.4 && bandOf(r("Beta").frequency) === "common", r("Beta").frequency);
check("Gamma is in 1 of 5 = 20% = rare", r("Gamma").frequency === 0.2 && bandOf(r("Gamma").frequency) === "rare", r("Gamma").frequency);
check("a new JD lowers the share of skills it does not mention", (() => {
  const before = r("Beta").frequency;
  p = mergeJd(p, jd(["Zeta skill"]), "", "j6").profile;
  return r("Beta").frequency < before && r("Beta").frequency === 2 / 6;
})(), r("Beta").frequency);
check("the employer's wording is kept", r("Alpha").targetWording === "Alpha skill wording", r("Alpha").targetWording);

// ---------- Part 2: live, a different field ----------
const UX_JDS = [
  `Junior UX Designer, Northlight Digital, Leeds. You will plan and run user interviews, turn what you learn into journey maps, and build wireframes and clickable prototypes in Figma. You will present your work to clients and explain your design decisions clearly. Work closely with developers on handoff. Run usability tests and iterate. Knowledge of accessibility standards is expected. A portfolio of case studies is required.`,
  `UX Designer, Brightpath Studio, remote UK. Responsibilities: conduct user research (interviews, surveys), create wireframes, flows and prototypes, run usability testing sessions, and present to stakeholders. You collaborate daily with product managers and engineers. Experience with Figma required. Accessibility (WCAG) awareness. Portfolio link required with at least two case studies.`,
  `Product Designer (Junior), Fernhill Health, Manchester. Own the design of features end to end: discovery interviews with patients and clinicians, information architecture, high fidelity prototypes in Figma, and design system components. Communicate clearly with non-designers. Test designs with real users. Inclusive design for people with disabilities is central to our work. Show us a portfolio.`,
];

(async () => {
  console.log("\nLive, different field: teacher to UX designer (3 JDs + 1 sort)");
  const { POST: jdRoute } = await import("../app/api/jd/route");
  const { POST: bridgeRoute } = await import("../app/api/bridge/route");
  const call = async <T,>(post: typeof jdRoute, route: string, body: unknown): Promise<T> => {
    const res = await post(new Request(`http://local/api/${route}`, { method: "POST", body: JSON.stringify(body) }));
    if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
    return res.json();
  };

  let h = structuredClone(teacher);
  h.skills = [];
  h.targetRole = { jds: [], requirements: [] };
  for (const [i, text] of UX_JDS.entries()) {
    const parsed = await call<JdResult>(jdRoute, "jd", { text, roleHint: h.goal.targetRole, existing: h.targetRole.requirements.map((x) => x.label) });
    h = mergeJd(h, parsed, text, `u${i + 1}`).profile;
  }
  const reqs = h.targetRole.requirements;
  console.log(`  ${reqs.length} skills read from the text: ${reqs.map((x) => `${x.label} ${x.sourceJdIds.length}/3`).join("; ")}`);
  check("skills were read from the text (at least 6)", reqs.length >= 6, reqs.length);
  check("something asked for by all 3 JDs is a must-have", reqs.some((x) => x.sourceJdIds.length === 3 && bandOf(x.frequency) === "must-have"));
  check("research, prototyping and portfolio all appear (from the text, no list)", ["research", "prototyp|wireframe", "portfolio"].every((re) => reqs.some((x) => new RegExp(re, "i").test(x.label))), reqs.map((x) => x.label));

  const out = applyBridge(h, await call<BridgeResult>(bridgeRoute, "bridge", bridgeInput(h)));
  const by = (c: string) => out.skills.filter((s) => s.status === c);
  console.log(`  have ${by("have").length}, transferable ${by("transferable").length}, missing ${by("missing").length}`);
  check("every requirement is sorted into exactly one column", out.skills.length === reqs.length && out.skills.every((s) => ["have", "transferable", "missing"].includes(s.status)));
  check("at least one transferable skill shows both wordings", by("transferable").some((s) => !!s.oldWording && !!s.targetWording && s.oldWording !== s.targetWording), by("transferable").map((s) => [s.oldWording, s.targetWording]));
  check("every quote is word for word from her own text", out.skills.filter((s) => s.status !== "missing").every((s) => s.evidence.length === 1 && s.evidenceVerified === true), out.skills.filter((s) => s.status !== "missing" && s.evidenceVerified !== true).map((s) => [s.label, s.evidence]));
  check("missing skills carry no evidence and level 0", by("missing").every((s) => s.evidence.length === 0 && s.current === 0));
  check("the skill with no teaching link (design tools) is not claimed", !out.skills.some((s) => /figma|prototyp|wireframe/i.test(s.label) && s.status === "have"), out.skills.filter((s) => /figma|prototyp|wireframe/i.test(s.label)).map((s) => [s.label, s.status]));
  for (const s of by("transferable")) console.log(`   ~ ${s.label}: "${s.oldWording}" -> "${s.targetWording}"`);

  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall bridge tests passed");
  process.exit(fails.length ? 1 : 0);
})();
