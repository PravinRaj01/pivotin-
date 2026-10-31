import { normLabel } from "./bridge";
import { fitBand, liveFit } from "./fit";
import type { ApplicationLogResult, ApplicationInsightResult } from "./schemas/agents";
import type { PivotProfile } from "./types";

// The deterministic half of the tracker. The agents turn speech into a row and explain patterns; code decides
// what the statuses mean, counts everything, and decides whether a pattern is allowed to be claimed at all.

export type App = PivotProfile["applications"][number];
export type Status = App["status"];

export const STATUSES: Status[] = ["saved", "applied", "response", "interview", "offer", "rejected"];
export const STATUS_LABEL: Record<Status, string> = { saved: "Saved", applied: "Applied", response: "Response", interview: "Interview", offer: "Offer", rejected: "Rejected" };
export const CHANNELS = ["Referral", "Careers page", "Job board", "Recruiter", "Event", "Other"] as const;

// ---------- turning speech into clean values ----------

export function canonStatus(raw: string): Status | "" {
  const s = raw.toLowerCase();
  if (!s.trim()) return "";
  if (/offer/.test(s)) return "offer";
  if (/reject|declin|turned me down|not moving forward|no longer|unsuccessful/.test(s)) return "rejected";
  if (/interview|onsite|on-site|panel|round|assignment|case study/.test(s)) return "interview";
  if (/respon|heard back|replied|screen|recruiter (called|reached|messaged)|call booked|shortlist/.test(s)) return "response";
  if (/saved|bookmark|want to apply|plan to apply|will apply|thinking of applying/.test(s)) return "saved";
  if (/appl/.test(s)) return "applied";
  return (STATUSES as string[]).includes(s.trim()) ? (s.trim() as Status) : "";
}

export function canonChannel(raw: string): string {
  const s = raw.toLowerCase();
  if (!s.trim()) return "";
  if (/referr|friend|colleague|employee|someone i know|knew someone|through (a|my)|intro/.test(s)) return "Referral";
  if (/career|company (site|website|page)|their (site|website)|directly|own website/.test(s)) return "Careers page";
  if (/linkedin|naukri|indeed|glassdoor|job board|job site|portal|wellfound|instahyre|monster/.test(s)) return "Job board";
  if (/recruit|headhunt|agency|consultanc/.test(s)) return "Recruiter";
  if (/event|meetup|campus|career fair|conference|hackathon/.test(s)) return "Event";
  return "Other";
}

export function canonResume(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const n = s.match(/(?:version|ver|v|resume|cv)\s*#?\s*(\d+)/i) ?? s.match(/\b(\d+)\b/);
  if (n) return `Version ${n[1]}`;
  const words: Record<string, number> = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4 };
  const w = s.toLowerCase().match(/\b(first|second|third|fourth|one|two|three|four)\b/);
  return w ? `Version ${words[w[1]]}` : s.slice(0, 30);
}

export function isoDate(raw: string, today: string): string {
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw));
  if (!ok) return today;
  return Date.parse(raw) > Date.parse(today) + 86400000 ? today : raw; // an application cannot be in the future
}

// ---------- counting ----------

// A response, an interview or an offer all mean the employer engaged. A rejection on its own is not counted as a response,
// because the tracker does not know whether it came after one.
export const engaged = (a: App) => a.status === "response" || a.status === "interview" || a.status === "offer";
export const sent = (apps: App[]) => apps.filter((a) => a.status !== "saved");

export function funnel(apps: App[]) {
  const by = (s: Status) => apps.filter((a) => a.status === s).length;
  const n = sent(apps).length;
  const e = sent(apps).filter(engaged).length;
  return { saved: by("saved"), applied: by("applied"), response: by("response"), interview: by("interview"), offer: by("offer"), rejected: by("rejected"), sent: n, engaged: e, rate: n ? e / n : 0 };
}

// ---------- how sure can we be ----------

export const MIN_GROUP = 5; // no claim is made about a group of fewer than 5 applications, or against fewer than 5 others
export const MIN_GAP = 0.25; // and the gap in response rate must be at least 25 points
export const MAX_P = 0.1; // and it must be unlikely to be luck (exact test)

export type Confidence = { tier: "none" | "early" | "emerging" | "established"; label: string };
export function confidenceFor(total: number): Confidence {
  if (total < MIN_GROUP) return { tier: "none", label: `Not enough yet, ${total} application${total === 1 ? "" : "s"}` };
  if (total < 15) return { tier: "early", label: `Early signal, ${total} applications` };
  if (total < 30) return { tier: "emerging", label: `Emerging pattern, ${total} applications` };
  return { tier: "established", label: `Established pattern, ${total} applications` };
}

const logFact: number[] = [0];
for (let i = 1; i <= 400; i++) logFact[i] = logFact[i - 1] + Math.log(i);
const logChoose = (n: number, k: number) => (k < 0 || k > n ? -Infinity : logFact[n] - logFact[k] - logFact[n - k]);

// Fisher's exact test, two-sided: how likely is a split at least this lopsided if the group made no difference?
export function fisherExact(groupEngaged: number, groupN: number, restEngaged: number, restN: number): number {
  const N = groupN + restN;
  const K = groupEngaged + restEngaged;
  const prob = (x: number) => Math.exp(logChoose(K, x) + logChoose(N - K, groupN - x) - logChoose(N, groupN));
  const observed = prob(groupEngaged);
  let p = 0;
  for (let x = Math.max(0, groupN - (N - K)); x <= Math.min(groupN, K); x++) {
    const px = prob(x);
    if (px <= observed + 1e-12) p += px;
  }
  return Math.min(1, p);
}

// ---------- patterns ----------

export const DIMENSIONS = [
  { key: "roleFamily", label: "Kind of role" },
  { key: "companyStage", label: "Company stage" },
  { key: "industry", label: "Industry" },
  { key: "channel", label: "How you applied" },
  { key: "resumeVersion", label: "Resume version" },
  { key: "fit", label: "Fit with the role" },
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export type Pattern = {
  id: string;
  dimension: DimensionKey;
  dimensionLabel: string;
  value: string;
  direction: "higher" | "lower"; // does this group hear back more or less often than everything else?
  n: number;
  engaged: number;
  restN: number;
  restEngaged: number;
  p: number;
};
export type SmallGroup = { dimension: DimensionKey; dimensionLabel: string; value: string; n: number };
export type Analysis = { total: number; engagedTotal: number; confidence: Confidence; patterns: Pattern[]; tooSmall: SmallGroup[]; comparisons: number };

export function valueOf(p: PivotProfile, a: App, key: DimensionKey): string {
  return key === "fit" ? fitBand(liveFit(p, a).score) : (a[key] ?? "").trim();
}

export function analyse(p: PivotProfile): Analysis {
  const apps = sent(p.applications);
  const total = apps.length;
  const engagedTotal = apps.filter(engaged).length;
  const confidence = confidenceFor(total);
  const out: Analysis = { total, engagedTotal, confidence, patterns: [], tooSmall: [], comparisons: 0 };
  if (total < MIN_GROUP) return out; // nothing at all is claimed from fewer than 5 applications

  for (const d of DIMENSIONS) {
    const values = new Map<string, App[]>();
    for (const a of apps) {
      const v = valueOf(p, a, d.key);
      if (v) values.set(v, [...(values.get(v) ?? []), a]);
    }
    for (const [value, group] of values) {
      const n = group.length;
      const restN = total - n;
      if (n < MIN_GROUP || restN < MIN_GROUP) {
        if (n < MIN_GROUP) out.tooSmall.push({ dimension: d.key, dimensionLabel: d.label, value, n });
        continue;
      }
      out.comparisons++;
      const e = group.filter(engaged).length;
      const re = engagedTotal - e;
      const gap = e / n - re / restN;
      const pv = fisherExact(e, n, re, restN);
      if (Math.abs(gap) >= MIN_GAP && pv <= MAX_P) {
        out.patterns.push({ id: `${d.key}:${value}`, dimension: d.key, dimensionLabel: d.label, value, direction: gap > 0 ? "higher" : "lower", n, engaged: e, restN, restEngaged: re, p: pv });
      }
    }
  }
  // Two groups in one dimension are mirror images of each other (one hears back more, the other less), so keep the
  // strongest finding per dimension, preferring the group that does better.
  const gap = (x: Pattern) => Math.abs(x.engaged / x.n - x.restEngaged / x.restN);
  const best = new Map<DimensionKey, Pattern>();
  for (const x of out.patterns) {
    const cur = best.get(x.dimension);
    if (!cur || x.p < cur.p - 1e-12 || (Math.abs(x.p - cur.p) <= 1e-12 && (x.direction === "higher" ? 1 : 0) > (cur.direction === "higher" ? 1 : 0))) best.set(x.dimension, x);
  }
  out.patterns = [...best.values()].sort((a, b) => a.p - b.p || gap(b) - gap(a)).slice(0, 3);
  return out;
}

// Changes whenever the counts behind the patterns change, so an old explanation can be recognised as out of date.
export function insightKey(a: Analysis): string {
  return `${a.total}|${a.engagedTotal}|` + a.patterns.map((x) => `${x.id}:${x.n}/${x.engaged}/${x.restN}/${x.restEngaged}`).join(",");
}

export function insightInput(p: PivotProfile, a: Analysis) {
  return {
    targetRole: p.goal.targetRole,
    alternateRoles: p.goal.alternateRoles,
    confidence: a.confidence.label,
    applicationsSent: a.total,
    gotResponse: a.engagedTotal,
    comparisonsChecked: a.comparisons,
    patterns: a.patterns.map((x) => ({
      patternId: x.id,
      dimension: x.dimensionLabel,
      value: x.value,
      direction: x.direction === "higher" ? "heard back more often than everything else" : "heard back less often than everything else",
      group: { applications: x.n, heardBack: x.engaged },
      everythingElse: { applications: x.restN, heardBack: x.restEngaged },
    })),
    roleTitlesSeen: [...new Set(sent(p.applications).map((x) => x.role))].slice(0, 12),
    roleFamiliesSeen: [...new Set(sent(p.applications).map((x) => x.roleFamily).filter(Boolean))],
  };
}

// Keep only what the analysis allows: findings about patterns that passed, with no invented numbers, and suggestions
// that follow from a pattern. Throws if nothing usable is left.
export function shapeInsights(p: PivotProfile, a: Analysis, r: ApplicationInsightResult, now: string): NonNullable<PivotProfile["applicationInsights"]> {
  const ids = new Set(a.patterns.map((x) => x.id));
  const byId = new Map(a.patterns.map((x) => [x.id, x]));
  const allowedNumbers = (x: Pattern) => new Set([x.n, x.engaged, x.restN, x.restEngaged, a.total, a.engagedTotal, Math.round((100 * x.engaged) / x.n), Math.round((100 * x.restEngaged) / x.restN)]);
  const numbersOk = (text: string, pat: Pattern) => (text.match(/\d+(?:\.\d+)?/g) ?? []).every((t) => allowedNumbers(pat).has(Number(t)));

  const findings = r.findings
    .filter((f) => ids.has(f.patternId) && f.text.trim() && numbersOk(f.text, byId.get(f.patternId)!))
    .slice(0, 3)
    .map((f) => ({ patternId: f.patternId, text: f.text.trim() }));
  if (!findings.length) throw new Error("The explanation did not match the patterns found. Try again.");

  const known = new Set([...sent(p.applications).flatMap((x) => [x.role, x.roleFamily]), p.goal.targetRole, ...p.goal.alternateRoles, ...a.patterns.filter((x) => x.dimension === "roleFamily").map((x) => x.value)].filter(Boolean).map(normLabel));
  const suggestions = r.suggestions
    .filter((s) => ids.has(s.patternId) && s.text.trim())
    .filter((s) => s.kind !== "target-role" || (!!s.role && known.has(normLabel(s.role)))) // a suggested role must be one that appears in the data
    .slice(0, 3)
    .map((s) => ({ kind: s.kind, text: s.text.trim(), role: s.kind === "target-role" ? s.role!.trim() : undefined, patternId: s.patternId }));

  return { key: insightKey(a), createdAt: now, headline: r.headline.trim() || a.confidence.label, findings, suggestions, caveat: r.caveat.trim() };
}

// ---------- logging by voice ----------

export function trackerInput(p: PivotProfile, utterance: string, today: string) {
  const apps = p.applications;
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  return {
    utterance,
    today,
    targetRole: p.goal.targetRole,
    existing: {
      roleFamilies: uniq(apps.map((a) => a.roleFamily)),
      companyStages: uniq(apps.map((a) => a.companyStage)),
      industries: uniq(apps.map((a) => a.industry)),
      resumeVersions: uniq(apps.map((a) => a.resumeVersion)),
      applications: apps.map((a) => ({ company: a.company, role: a.role, status: a.status })).slice(0, 40),
    },
  };
}

const reuse = (value: string, existing: string[]) => existing.find((e) => normLabel(e) === normLabel(value)) ?? value.trim();
const words = (s: string) => new Set(normLabel(s).split(" ").filter((w) => w.length > 2));
// How much of the spoken role is in an existing role (1 = all of it).
const roleScore = (spoken: string, existing: string) => {
  const w = words(spoken);
  if (!w.size) return 0;
  const e = words(existing);
  return [...w].filter((x) => e.has(x)).length / w.size;
};

export type LogOutcome = { profile: PivotProfile; row: App; mode: "added" | "updated" };

// Add a row, or update the one already there (for example a saved role you have now applied to).
export function applyLog(p: PivotProfile, r: ApplicationLogResult, today: string, id: string = crypto.randomUUID(), pastedFit?: number | null): LogOutcome {
  const company = r.company.trim();
  if (!company) throw new Error("I did not catch which company this was. Say the company name.");
  const apps = p.applications;
  const sameCompany = apps.filter((a) => normLabel(a.company) === normLabel(company));
  let target: App | undefined;
  if (sameCompany.length === 1 && !r.role.trim()) target = sameCompany[0];
  else if (sameCompany.length > 1 && !r.role.trim()) throw new Error(`You have ${sameCompany.length} applications at ${company}. Say which role: ${sameCompany.map((a) => a.role).join(", ")}.`);
  else if (sameCompany.length && r.role.trim()) {
    // the existing role that matches what was said best; a tie is a real ambiguity
    const scored = sameCompany.map((a) => ({ a, s: normLabel(a.role) === normLabel(r.role) ? 2 : roleScore(r.role, a.role) })).sort((x, y) => y.s - x.s);
    const top = scored.filter((x) => x.s === scored[0].s);
    if (scored[0].s >= 0.5 && top.length === 1) target = top[0].a;
    else if (scored[0].s >= 0.5) throw new Error(`You have ${top.length} applications at ${company} that could be this one. Say which role: ${top.map((x) => x.a.role).join(", ")}.`);
  }
  if (!target && r.action === "update") throw new Error(sameCompany.length ? `I found ${company}, but not that role. You have: ${sameCompany.map((a) => a.role).join(", ")}.` : `I could not find an application at ${company} to update. Say "applied to ${company}..." to add it.`);

  const status = canonStatus(r.status);
  const channel = r.channel.trim() ? canonChannel(r.channel) : "";
  const resume = canonResume(r.resumeVersion);
  const inferred = r.inferred.filter((f) => ["companyStage", "industry", "roleFamily"].includes(f));
  const family = r.roleFamily.trim() ? reuse(r.roleFamily, apps.map((a) => a.roleFamily)) : "";
  const stage = r.companyStage.trim() ? reuse(r.companyStage, apps.map((a) => a.companyStage)) : "";
  const industry = r.industry.trim() ? reuse(r.industry, apps.map((a) => a.industry)) : "";
  const appliedOn = isoDate(r.appliedOn, today);

  if (target) {
    const nextStatus = status || target.status;
    const becameApplied = target.status === "saved" && nextStatus !== "saved";
    const row: App = {
      ...target,
      role: target.role || r.role.trim(),
      status: nextStatus,
      roleFamily: target.roleFamily || family,
      companyStage: target.companyStage || stage,
      industry: target.industry || industry,
      channel: channel || target.channel,
      resumeVersion: resume || target.resumeVersion,
      dates: { ...target.dates, applied: target.dates.applied ?? (becameApplied || nextStatus !== "saved" ? appliedOn : undefined) },
      notes: r.notes.trim() ? [target.notes, r.notes.trim()].filter(Boolean).join(" ") : target.notes,
      location: target.location || r.location.trim() || undefined,
      fitScore: pastedFit ?? target.fitScore,
      fitBasis: pastedFit != null ? ("job description" as const) : target.fitBasis,
      // a field counts as a guess only if it was empty before and the agent filled it from general knowledge now
      inferred: [...new Set([...target.inferred, ...inferred.filter((f) => (f === "companyStage" ? !target.companyStage && !!stage : f === "industry" ? !target.industry && !!industry : !target.roleFamily && !!family))])],
    };
    return { profile: { ...p, applications: apps.map((a) => (a.id === target!.id ? row : a)) }, row, mode: "updated" };
  }

  if (!r.role.trim()) throw new Error(`I did not catch the role at ${company}. Say what role it was.`);
  const finalStatus: Status = status || "applied";
  const row: App = {
    id,
    company,
    role: r.role.trim(),
    status: finalStatus,
    dates: { applied: finalStatus === "saved" ? undefined : appliedOn },
    fitScore: pastedFit ?? undefined,
    fitBasis: pastedFit != null ? "job description" : undefined,
    notes: r.notes.trim(),
    followUps: [],
    location: r.location.trim() || undefined,
    source: "Logged by voice",
    roleFamily: family,
    companyStage: stage,
    industry,
    channel,
    resumeVersion: resume,
    inferred,
  };
  return { profile: { ...p, applications: [...apps, row] }, row, mode: "added" };
}

export function setStatus(p: PivotProfile, id: string, status: Status, today: string): PivotProfile {
  return {
    ...p,
    applications: p.applications.map((a) => (a.id === id ? { ...a, status, dates: { ...a.dates, applied: a.dates.applied ?? (status !== "saved" ? today : undefined) } } : a)),
  };
}
