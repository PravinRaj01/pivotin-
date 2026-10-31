import { statusFor } from "../bridge";
import type { PivotProfile, Skill, Task } from "../types";

// Compact builders so a seed persona reads like data, not boilerplate.

type SkillRow = [id: string, label: string, category: Skill["category"], current: number, required: number, evidence: string[]];

export function makeSkills(rows: SkillRow[]): Skill[] {
  return rows.map(([id, label, category, current, required, evidence]) => ({
    id,
    label,
    category,
    current,
    required,
    evidence,
    status: statusFor(current, required),
  }));
}

type TaskRow = [title: string, hours: number, skillIds: string[], status?: Task["status"]];
type WeekRow = [theme: string, tasks: TaskRow[]];

export function makeWeeks(rows: WeekRow[], doneThrough: number): PivotProfile["plan"]["weeks"] {
  return rows.map(([theme, tasks], i) => {
    const n = i + 1;
    return {
      n,
      theme,
      hours: tasks.reduce((s, t) => s + t[1], 0),
      tasks: tasks.map(([title, estHours, skillIds, status], j) => ({
        id: `w${n}t${j + 1}`,
        title,
        skillIds,
        estHours,
        status: status ?? (n <= doneThrough ? "done" : "todo"),
      })),
    };
  });
}

export const reqFromSkills = (
  skills: Skill[],
  freq: Record<string, number>,
  jdIds: string[],
): PivotProfile["targetRole"]["requirements"] =>
  skills.map((s) => {
    const f = freq[s.id] ?? 0.5;
    return {
      skillId: s.id,
      label: s.label,
      category: s.category,
      importance: Math.max(1, Math.min(5, Math.round(f * 5))),
      frequency: f,
      sourceJdIds: jdIds,
    };
  });
