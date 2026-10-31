import type { JdResult, BridgeResult } from "./schemas/jd";
import type { PivotProfile, Skill } from "./types";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "skill";

// Levels are whole numbers 0-3. Within one level of the bar (and not starting from zero) is transferable.
export function statusFor(current: number, required: number): Skill["status"] {
  if (current >= required) return "have";
  return required - current <= 1 && current > 0 ? "transferable" : "gap";
}

const clampLevel = (n: number) => Math.max(0, Math.min(3, Math.round(n)));

// Fold one parsed JD into the target role. Skills already tracked keep their id, so
// the plan and earlier ratings stay attached to them.
export function mergeJd(p: PivotProfile, jd: JdResult, rawText: string): { profile: PivotProfile; newSkillIds: string[] } {
  const jdId = crypto.randomUUID();
  const before = p.targetRole.jds.length;
  const reqs = p.targetRole.requirements.map((r) => ({ ...r }));
  const newSkillIds: string[] = [];
  const seen = new Set<string>();

  for (const r of jd.requirements) {
    const label = r.label.trim();
    let hit = reqs.find((x) => x.label.toLowerCase() === label.toLowerCase());
    if (!hit) {
      let id = slug(label);
      while (reqs.some((x) => x.skillId === id)) id += "-2";
      hit = { skillId: id, label, category: r.category, importance: r.importance, frequency: 0, sourceJdIds: [] };
      reqs.push(hit);
      newSkillIds.push(id);
    }
    seen.add(hit.skillId);
    hit.importance = Math.max(hit.importance, r.importance);
    hit.sourceJdIds = [...hit.sourceJdIds, jdId];
    // running share of JDs that mention it, so seeded frequencies are preserved
    hit.frequency = (hit.frequency * before + 1) / (before + 1);
  }
  for (const r of reqs) if (!seen.has(r.skillId)) r.frequency = (r.frequency * before) / (before + 1);

  return {
    newSkillIds,
    profile: {
      ...p,
      targetRole: {
        jds: [
          ...p.targetRole.jds,
          { id: jdId, title: jd.title || p.goal.targetRole, company: jd.company, rawText, addedAt: new Date().toISOString() },
        ],
        requirements: reqs,
      },
    },
  };
}

export function bridgeInput(p: PivotProfile) {
  return {
    person: p.person,
    goal: { targetRole: p.goal.targetRole, targetIndustry: p.goal.targetIndustry },
    experience: p.experience.map(({ role, org, period, achievements, toolsUsed }) => ({ role, org, period, achievements, toolsUsed })),
    // Earlier ratings keep scores stable when only the requirements change.
    previousRatings: p.skills.map(({ id, current, evidence }) => ({ skillId: id, current, evidence })),
    strengths: p.story.strengths,
    summary: p.story.summary,
    requirements: p.targetRole.requirements.map(({ skillId, label, category, importance, frequency }) => ({
      skillId,
      label,
      category,
      importance,
      frequency: Math.round(frequency * 100) / 100,
    })),
  };
}

export function applyBridge(p: PivotProfile, r: BridgeResult): PivotProfile {
  const byId = new Map(r.skills.map((s) => [s.skillId, s]));
  const now = new Date().toISOString();
  const skills: Skill[] = p.targetRole.requirements.map((req) => {
    const s = byId.get(req.skillId);
    const old = p.skills.find((x) => x.id === req.skillId);
    const current = clampLevel(s?.current ?? old?.current ?? 0);
    const required = clampLevel(s?.required ?? old?.required ?? (req.importance / 5) * 3);
    return {
      id: req.skillId,
      label: req.label,
      category: req.category,
      current,
      required,
      evidence: s?.evidence ?? old?.evidence ?? [],
      status: statusFor(current, required),
      lastVerifiedAt: now,
    };
  });
  return { ...p, skills };
}
