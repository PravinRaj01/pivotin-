import type { IntakeResult } from "./schemas/intake";
import type { PivotProfile } from "./types";

const pick = <T,>(fresh: T | undefined, old: T, empty: (v: T) => boolean = (v) => !v): T =>
  fresh !== undefined && !empty(fresh) ? fresh : old;

const addDays = (from: string, days: number) => new Date(Date.parse(from) + days * 864e5).toISOString().slice(0, 10);

// Fold an intake result into the profile. Anything the speaker did not say (0, "" or []) leaves
// the existing value alone, so a second pass or a follow-up answer never wipes earlier facts.
export function applyIntake(p: PivotProfile, r: IntakeResult, transcript: string, today: string): PivotProfile {
  const weeks = r.goal.timelineWeeks > 0 ? r.goal.timelineWeeks : p.goal.timelineWeeks;
  const prefs = [...r.preferences];
  for (const old of p.story.preferences) if (!prefs.some((x) => x.text.toLowerCase() === old.text.toLowerCase())) prefs.push(old);

  return {
    ...p,
    person: {
      ...p.person,
      name: pick(r.person.name, p.person.name),
      location: pick(r.person.location, p.person.location),
      yearsExperience: pick(r.person.yearsExperience, p.person.yearsExperience, (v) => !v),
      currentRole: pick(r.person.currentRole, p.person.currentRole),
      currentIndustry: pick(r.person.currentIndustry, p.person.currentIndustry),
      education: pick(r.person.education, p.person.education, (v) => !v) || undefined,
    },
    goal: {
      ...p.goal,
      targetRole: r.goal.targetRole || p.goal.targetRole,
      targetIndustry: r.goal.targetIndustry || p.goal.targetIndustry,
      alternateRoles: r.goal.alternateRoles.length ? r.goal.alternateRoles : p.goal.alternateRoles,
      timelineWeeks: weeks,
      deadline: r.goal.deadline || (r.goal.timelineWeeks > 0 ? addDays(today, r.goal.timelineWeeks * 7) : p.goal.deadline),
      hoursPerWeek: r.goal.hoursPerWeek > 0 ? r.goal.hoursPerWeek : p.goal.hoursPerWeek,
      salaryFloor: r.goal.salaryFloor?.amount ? r.goal.salaryFloor : p.goal.salaryFloor,
      cities: r.goal.cities.length ? r.goal.cities : p.goal.cities,
      motivation: pick(r.goal.motivation, p.goal.motivation),
      constraints: r.goal.constraints.length ? r.goal.constraints : p.goal.constraints,
    },
    story: {
      ...p.story,
      rawTranscripts: p.story.rawTranscripts.some((t) => t.text === transcript)
        ? p.story.rawTranscripts
        : [...p.story.rawTranscripts, { id: crypto.randomUUID(), at: new Date().toISOString(), text: transcript }],
      summary: pick(r.summary, p.story.summary),
      strengths: r.strengths.length ? r.strengths : p.story.strengths,
      fears: r.fears.length ? r.fears : p.story.fears,
      preferences: prefs,
      corrections: r.corrections,
      roleSuggestions: r.goal.targetRole ? [] : r.roleSuggestions,
      followUp: r.followUp?.question ? { field: r.followUp.field, question: r.followUp.question } : null,
    },
    experience: r.experience.length ? r.experience.map((e) => ({ ...e, id: crypto.randomUUID() })) : p.experience,
  };
}

// The person picked one of the offered roles.
export function chooseRole(p: PivotProfile, title: string): PivotProfile {
  return {
    ...p,
    goal: { ...p.goal, targetRole: title },
    story: { ...p.story, roleSuggestions: [], followUp: p.story.followUp?.field === "targetRole" ? null : p.story.followUp },
  };
}
