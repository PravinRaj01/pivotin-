import { normLabel } from "./bridge";
import { readiness, type PivotProfile } from "./types";

// Fit comes from the bridge map, by code: how much of what a role asks for does the person already meet?
// A skill counts up to the level the role needs; the more important a requirement, the more it weighs.

type Application = PivotProfile["applications"][number];
export type Fit = { score: number; basis: "job description" | "overall map" };
export type Req = { skillId?: string; label: string; importance: number };

const levelFor = (importance: number) => Math.max(1, Math.min(3, Math.round((importance / 5) * 3)));

// null when there is nothing to compare with.
export function fitFromRequirements(p: PivotProfile, reqs: Req[]): number | null {
  let have = 0;
  let need = 0;
  for (const r of reqs) {
    const skill = p.skills.find((s) => s.id === r.skillId) ?? p.skills.find((s) => normLabel(s.label) === normLabel(r.label));
    const w = Math.max(1, Math.min(5, r.importance));
    const required = skill?.required ?? levelFor(r.importance);
    const current = skill?.current ?? 0; // a requirement the map does not know is a skill they do not have yet
    have += w * Math.min(current, required);
    need += w * required;
  }
  return need > 0 ? Math.round((100 * have) / need) : null;
}

// The fit shown for an application today. Linked job descriptions and the overall map follow the current skill levels;
// a job description pasted at logging time keeps the score it had then.
export function liveFit(p: PivotProfile, a: Application): Fit {
  const jd = a.jdId ? p.targetRole.jds.find((j) => j.id === a.jdId) : undefined;
  if (jd) {
    const reqs = p.targetRole.requirements.filter((r) => r.sourceJdIds.includes(jd.id)).map((r) => ({ skillId: r.skillId, label: r.label, importance: r.importance }));
    const score = reqs.length >= 3 ? fitFromRequirements(p, reqs) : null;
    if (score !== null) return { score, basis: "job description" };
  }
  if (a.fitBasis === "job description" && a.fitScore !== undefined) return { score: a.fitScore, basis: "job description" };
  return { score: readiness(p), basis: "overall map" };
}

export const fitBand = (score: number) => (score >= 65 ? "High fit" : score >= 40 ? "Medium fit" : "Low fit");
