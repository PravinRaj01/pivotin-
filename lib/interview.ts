import type { InterviewTurnResult, RubricResult } from "./schemas/agents";
import { withoutHeader } from "./transform";
import type { PivotProfile, Skill } from "./types";

// The deterministic half of the mock interview. The agents write the rubric, the questions and the scores;
// code decides the question order, checks the quotes, and changes skill levels.

export type Rubric = NonNullable<PivotProfile["rubric"]>;
export type Session = PivotProfile["interviews"][number];
export type Pending = NonNullable<Session["pending"]>;
export type NextPlan = { kind: "followup" | "role" | "none"; dimensionId?: string };

export const TOTAL_QUESTIONS = 5; // the opener, one follow-up, then three role questions
export const FIRST_QUESTION = "Why are you switching careers?";
const GENERIC = new Set(["what", "with", "that", "have", "your", "would", "about", "from", "this", "them", "they", "were", "when", "which", "could", "should", "there", "their", "tell", "more", "does", "make", "feel", "good", "role", "work", "think", "really", "specific", "specifically", "experience", "experiences"]);
// A follow-up must pick up something the person said: it shares at least one meaningful word with the answer.
export function picksUp(answer: string, question: string): boolean {
  const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length >= 4 && !GENERIC.has(w)));
  const a = words(answer);
  return [...words(question)].some((w) => a.has(w));
}

export const WEAK = 2; // a score of 1 or 2 out of 4 is weak

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "dimension";
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// ---------- rubric ----------

// A rubric belongs to a role and to the skills its job descriptions ask for most. If either changes, it is stale.
export function rubricKey(p: PivotProfile): string {
  const top = [...p.targetRole.requirements]
    .sort((a, b) => b.frequency - a.frequency || a.skillId.localeCompare(b.skillId))
    .slice(0, 12)
    .map((r) => r.skillId)
    .sort();
  return `${p.goal.targetRole.trim().toLowerCase()}|${top.join(",")}`;
}
export const rubricStale = (p: PivotProfile) => !!p.rubric && p.rubric.key !== rubricKey(p);

export function rubricInput(p: PivotProfile) {
  const total = p.targetRole.jds.length;
  return {
    targetRole: p.goal.targetRole,
    targetIndustry: p.goal.targetIndustry ?? "",
    jobTitles: [...new Set(p.targetRole.jds.map((j) => j.title).filter(Boolean))].slice(0, 12),
    requirements: [...p.targetRole.requirements]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 16)
      .map((r) => ({ skillId: r.skillId, label: r.label, askedForIn: `${r.sourceJdIds.length} of ${total}`, employerWording: r.targetWording ?? "" })),
  };
}

// Exactly 4 distinct dimensions, each with 4 level lines, linked only to skills that exist.
export function shapeRubric(p: PivotProfile, r: RubricResult, now: string): Rubric {
  const known = new Set(p.skills.map((s) => s.id).concat(p.targetRole.requirements.map((q) => q.skillId)));
  const dims = r.dimensions.slice(0, 4);
  if (dims.length < 4) throw new Error("The rubric came back with fewer than 4 dimensions. Try again.");
  const used = new Set<string>();
  const names = new Set<string>();
  const dimensions = dims.map((d, i) => {
    const levels = d.levels.map((l) => l.trim());
    if (levels.length !== 4 || levels.some((l) => !l)) throw new Error("A rubric dimension did not have 4 score levels. Try again.");
    const name = d.name.trim();
    if (names.has(norm(name))) throw new Error("The rubric repeated a dimension. Try again.");
    names.add(norm(name));
    let id = slug(d.id || name);
    while (used.has(id)) id += `-${i + 1}`;
    used.add(id);
    return { id, name, what: d.what.trim(), levels, skillIds: [...new Set(d.skillIds)].filter((s) => known.has(s)).slice(0, 2) };
  });
  return { key: rubricKey(p), role: p.goal.targetRole, createdAt: now, dimensions };
}

// ---------- answers ----------

// The Pivotin' transform tags text with labels such as [GOAL]. In an interview those are not part of the answer.
export const stripTransformTags = (text: string) =>
  withoutHeader(text)
    .replace(/\[[A-Z][A-Z0-9 _-]{1,24}\]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

// A quote counts as evidence only if it really is in the answer, word for word (ignoring case and punctuation).
export const verifyQuote = (answer: string, quote: string) => {
  const q = norm(quote);
  return q.length >= 3 && (" " + norm(answer) + " ").includes(" " + q + " ");
};

// ---------- the session ----------

export const activeSession = (p: PivotProfile): Session | undefined => [...p.interviews].reverse().find((s) => !s.finishedAt);

export function startSession(p: PivotProfile, now: string, id: string = crypto.randomUUID()): PivotProfile {
  if (activeSession(p)) return p;
  return { ...p, interviews: [...p.interviews, { id, startedAt: now, pending: { question: FIRST_QUESTION, kind: "switch" }, turns: [] }] };
}

// What comes after the question that is being answered now.
export function planNext(session: Session, rubric: Rubric): NextPlan {
  const answered = session.turns.length + 1;
  if (answered >= TOTAL_QUESTIONS) return { kind: "none" };
  if (answered === 1) return { kind: "followup" };
  // the dimension the fewest answers have been scored on so far (not the one just asked about)
  const counts = new Map(rubric.dimensions.map((d) => [d.id, 0]));
  for (const t of session.turns) for (const s of t.scores) counts.set(s.dimensionId, (counts.get(s.dimensionId) ?? 0) + 1);
  const avoid = session.pending?.dimensionId;
  const pool = rubric.dimensions.filter((d) => d.id !== avoid);
  const pick = [...pool].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0] ?? rubric.dimensions[0];
  return { kind: "role", dimensionId: pick.id };
}

export function interviewInput(p: PivotProfile, session: Session, answer: string, next: NextPlan) {
  const rubric = p.rubric!;
  const dim = rubric.dimensions.find((d) => d.id === next.dimensionId);
  const asked = session.pending?.dimensionId ? rubric.dimensions.find((d) => d.id === session.pending!.dimensionId) : undefined;
  return {
    targetRole: p.goal.targetRole,
    rubric: rubric.dimensions.map(({ id, name, what, levels }) => ({ id, name, what, levels })),
    question: session.pending?.question ?? "",
    questionKind: session.pending?.kind ?? "role",
    ...(asked ? { questionTests: { id: asked.id, name: asked.name } } : {}),
    answer,
    history: session.turns.map((t) => ({ question: t.question, answer: t.answer })),
    next: { kind: next.kind, dimensionId: dim?.id ?? "", dimensionName: dim?.name ?? "" },
    questionNumber: session.turns.length + 1,
    totalQuestions: TOTAL_QUESTIONS,
    background: p.experience.slice(0, 3).map(({ role, org, achievements }) => ({ role, org, achievements: achievements.slice(0, 3) })),
  };
}

// ---------- skills ----------

// One level down. Keeps the skill's column in step: "have" means level 2 or more, "missing" means 0.
export function lowerSkill(s: Skill): Skill {
  const current = Math.max(0, s.current - 1);
  const status: Skill["status"] = current === 0 ? "missing" : s.status === "have" && current < 2 ? "transferable" : s.status;
  return {
    ...s,
    current,
    status,
    evidence: status === "missing" ? [] : s.evidence,
    evidenceVerified: status === "missing" ? undefined : s.evidenceVerified,
    oldWording: status === "transferable" ? s.oldWording : undefined,
  };
}

export function applyTurn(p: PivotProfile, sessionId: string, r: InterviewTurnResult, answer: string, next: NextPlan, now: string): PivotProfile {
  const session = p.interviews.find((s) => s.id === sessionId);
  const rubric = p.rubric;
  if (!session || !session.pending || !rubric) throw new Error("There is no question waiting for an answer.");

  const seen = new Set<string>();
  const scores = r.scores
    .filter((s) => rubric.dimensions.some((d) => d.id === s.dimension) && !seen.has(s.dimension) && seen.add(s.dimension))
    .slice(0, 2)
    .map((s) => ({
      dimensionId: s.dimension,
      score: Math.max(1, Math.min(4, Math.round(s.score))),
      quote: s.quote.trim().slice(0, 240),
      verified: verifyQuote(answer, s.quote),
      why: s.why.trim(),
    }));
  if (!scores.length) throw new Error("I could not match that score to your rubric. Try again.");

  if (next.kind !== "none") {
    const q = r.nextQuestion.trim();
    const earlier = [session.pending.question, ...session.turns.map((t) => t.question)].map(norm);
    if (!q || earlier.includes(norm(q)) || /switch(ing)? careers?/i.test(q)) throw new Error("The next question repeated an earlier one. Try again.");
    if (next.kind === "followup" && !picksUp(answer, q)) throw new Error("The follow-up did not pick up anything you said. Try again.");
  }

  // Weak and backed by a real quote: lower each linked skill by one level, once per skill per interview.
  const lowered = new Set(session.turns.flatMap((t) => t.skillChanges.map((c) => c.skillId)));
  const changes: Session["turns"][number]["skillChanges"] = [];
  let skills = p.skills;
  for (const sc of scores) {
    if (sc.score > WEAK || !sc.verified) continue;
    for (const skillId of rubric.dimensions.find((d) => d.id === sc.dimensionId)!.skillIds) {
      const skill = skills.find((s) => s.id === skillId);
      if (!skill || skill.current < 1 || lowered.has(skillId)) continue;
      lowered.add(skillId);
      const after = lowerSkill(skill);
      changes.push({ skillId, from: skill.current, to: after.current });
      skills = skills.map((s) => (s.id === skillId ? after : s));
    }
  }

  const turn: Session["turns"][number] = {
    question: session.pending.question,
    kind: session.pending.kind,
    dimensionId: session.pending.dimensionId,
    answer,
    scores,
    improve: r.improve.trim(),
    skillChanges: changes,
  };
  const done = next.kind === "none";
  const updated: Session = {
    ...session,
    turns: [...session.turns, turn],
    pending: done ? null : { question: r.nextQuestion.trim(), kind: next.kind as "followup" | "role", dimensionId: next.dimensionId },
    finishedAt: done ? now : undefined,
  };
  return { ...p, skills, interviews: p.interviews.map((s) => (s.id === sessionId ? updated : s)) };
}

// Average score per dimension over a session, for the summary.
export function dimensionAverages(session: Session, rubric: Rubric) {
  return rubric.dimensions.map((d) => {
    const all = session.turns.flatMap((t) => t.scores.filter((s) => s.dimensionId === d.id));
    return { dimension: d, n: all.length, avg: all.length ? all.reduce((s, x) => s + x.score, 0) / all.length : 0 };
  });
}
