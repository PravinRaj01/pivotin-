import type { JdResult, BridgeResult } from "./schemas/jd";
import type { PivotProfile, Skill } from "./types";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "skill";

// Labels match ignoring case, punctuation and look-alike hyphens or quotes ("cross\u2011functional" == "cross-functional").
export const normLabel = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Levels are whole numbers 0-3: 0 none, 1 aware or basic, 2 working, 3 strong.
const clampLevel = (n: number) => Math.max(0, Math.min(3, Math.round(n)));

// Used for hand-written seed skills that have no agent column. Within one level of the bar,
// and not starting from zero, counts as transferable.
export function statusFor(current: number, required: number): Skill["status"] {
  if (current >= required) return "have";
  return required - current <= 1 && current > 0 ? "transferable" : "missing";
}

// How common a skill is across the job descriptions. Counted by code from the JDs, never by the model.
export type Band = "must-have" | "common" | "rare";
export const MUST_HAVE_SHARE = 0.6;
export const COMMON_SHARE = 0.3;
// The level a new hire is expected to show, from how common the skill is: must-have 3, common 2, rare 1.
export const requiredFor = (share: number): number => ({ "must-have": 3, common: 2, rare: 1 })[bandOf(share)];
export const bandOf = (share: number): Band => (share >= MUST_HAVE_SHARE ? "must-have" : share >= COMMON_SHARE ? "common" : "rare");

// Fold one parsed JD into the target role. A skill is matched by its label, so ratings and the plan
// stay attached to it. Frequency is always recomputed as (JDs that ask for it) / (all JDs).
export function mergeJd(
  p: PivotProfile,
  jd: JdResult,
  rawText: string,
  jdId: string = crypto.randomUUID(),
): { profile: PivotProfile; newSkillIds: string[] } {
  const reqs = p.targetRole.requirements.map((r) => ({ ...r, sourceJdIds: [...r.sourceJdIds] }));
  const newSkillIds: string[] = [];

  for (const r of jd.requirements) {
    const label = r.label.trim();
    if (!label) continue;
    let hit = reqs.find((x) => normLabel(x.label) === normLabel(label));
    if (!hit) {
      let id = slug(label);
      while (reqs.some((x) => x.skillId === id)) id += "-2";
      hit = { skillId: id, label, category: r.category, importance: r.importance, frequency: 0, sourceJdIds: [] };
      reqs.push(hit);
      newSkillIds.push(id);
    }
    if (!hit.sourceJdIds.includes(jdId)) hit.sourceJdIds.push(jdId); // each JD counts once per skill
    hit.importance = Math.max(hit.importance, r.importance);
    if (!hit.targetWording && r.wording) hit.targetWording = r.wording;
  }

  const total = p.targetRole.jds.length + 1;
  for (const r of reqs) r.frequency = r.sourceJdIds.length / total;

  return {
    newSkillIds,
    profile: {
      ...p,
      targetRole: {
        jds: [...p.targetRole.jds, { id: jdId, title: jd.title || p.goal.targetRole, company: jd.company, rawText, addedAt: new Date().toISOString() }],
        requirements: reqs,
      },
    },
  };
}

// Everything the person has said or written about their own work: the only text a quote may come from.
export function evidenceSources(p: PivotProfile) {
  return {
    resume: p.person.resume ?? "",
    story: p.story.rawTranscripts.map((t) => t.text).join("\n\n"),
    experience: p.experience.map(({ role, org, period, achievements, toolsUsed }) => ({ role, org, period, achievements, toolsUsed })),
  };
}

export function bridgeInput(p: PivotProfile) {
  const total = p.targetRole.jds.length;
  return {
    person: { currentRole: p.person.currentRole, currentIndustry: p.person.currentIndustry, yearsExperience: p.person.yearsExperience },
    goal: { targetRole: p.goal.targetRole, targetIndustry: p.goal.targetIndustry },
    background: evidenceSources(p),
    // Earlier ratings keep scores stable when only the requirements change.
    previousRatings: p.skills.map(({ id, current, status }) => ({ skillId: id, level: current, column: status })),
    jobDescriptionsAnalysed: total,
    requirements: p.targetRole.requirements.map((r) => ({
      skillId: r.skillId,
      label: r.label,
      category: r.category,
      importance: r.importance,
      askedForIn: `${r.sourceJdIds.length} of ${total}`,
      employerWording: r.targetWording ?? "",
    })),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function applyBridge(p: PivotProfile, r: BridgeResult): PivotProfile {
  const byId = new Map(r.skills.map((s) => [s.skillId, s]));
  const src = p.person.resume + "\n" + p.story.rawTranscripts.map((t) => t.text).join("\n") + "\n" + p.experience.flatMap((e) => [e.role, e.org, ...e.achievements, ...e.toolsUsed]).join("\n");
  const haystack = " " + norm(src) + " ";
  const now = new Date().toISOString();

  const skills: Skill[] = p.targetRole.requirements.map((req) => {
    const s = byId.get(req.skillId);
    const old = p.skills.find((x) => x.id === req.skillId);
    const required = requiredFor(req.frequency); // by code, so it is explainable and the same for every provider
    const column = s?.column ?? old?.status ?? "missing";
    let current = clampLevel(s?.current ?? old?.current ?? 0);
    // Keep the level consistent with the column the agent chose.
    if (column === "missing") current = 0;
    else if (column === "transferable") current = Math.max(1, Math.min(current, Math.max(1, required - 1)));
    else current = Math.max(current, 2); // "have" means working level or better

    const quote = (s?.quote ?? "").trim();
    const nq = norm(quote);
    const verified = !!nq && haystack.includes(" " + nq + " ");
    // A quote that is not word for word in their own text is kept but flagged; "missing" needs none.
    const evidence = column === "missing" ? [] : quote ? [quote] : (old?.evidence ?? []);
    return {
      id: req.skillId,
      label: req.label,
      category: req.category,
      current,
      required,
      evidence,
      status: column,
      oldWording: column === "transferable" ? s?.oldWording || old?.oldWording : undefined,
      targetWording: s?.targetWording || req.targetWording || undefined,
      evidenceVerified: column === "missing" ? undefined : quote ? verified : old?.evidenceVerified,
      lastVerifiedAt: now,
    };
  });
  return { ...p, skills };
}
