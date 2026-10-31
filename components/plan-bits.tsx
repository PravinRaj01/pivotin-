"use client";

import { Chip } from "@/components/ui";
import { resourceById } from "@/lib/planner";
import type { PivotProfile } from "@/lib/types";

export type Week = PivotProfile["plan"]["weeks"][number];
export type PlanTask = Week["tasks"][number];

const COST: Record<string, string> = { free: "Free", "free-with-signup": "Free, needs sign-up", paid: "Paid", mixed: "Partly free" };
const EFFORT: Record<string, string> = { short: "under 2 h", medium: "2 to 8 h", long: "8 h or more" };

// One task: a checkbox, its hours, and either a real curated link or an honest "none for this skill".
export function TaskItem({ t, labels, projectTitle, onToggle }: { t: PlanTask; labels: Map<string, string>; projectTitle?: string; onToggle: () => void }) {
  const done = t.status === "done";
  const res = resourceById(t.resourceId);
  return (
    <li className="flex gap-3 py-2.5">
      <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`Mark done: ${t.title}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-muted line-through" : ""}`}>
          {t.kind === "milestone" && (
            <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs no-underline">Project milestone{projectTitle ? `: ${projectTitle}` : ""}</span>
          )}
          {t.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{t.estHours} h</span>
          {t.kind === "learn" && t.skillIds.slice(0, 2).map((id) => <Chip key={id}>{labels.get(id) ?? id}</Chip>)}
        </div>
        {t.kind === "learn" && !done && (
          <p className="mt-1 text-xs">
            {res ? (
              <>
                <span className="text-muted">Learn: </span>
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                  {res.title} ({res.provider})
                </a>
                <span className="text-muted">
                  {" "}
                  - {COST[res.cost] ?? res.cost}, {EFFORT[res.effort] ?? res.effort}
                </span>
              </>
            ) : (
              <span className="italic text-muted">No curated resource for this skill yet, so I am not guessing one. Search for it, or ask a mentor.</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

// Hours planned in a week against the hours the person has.
export function HoursBar({ planned, done, budget }: { planned: number; done: number; budget: number }) {
  const pct = (x: number) => `${Math.min(100, (x / Math.max(budget, 1)) * 100)}%`;
  return (
    <div className="flex items-center gap-2 text-xs text-muted" title={`${planned} of ${budget} hours planned, ${done} done`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="relative h-full" style={{ width: pct(planned) }}>
          <div className="absolute inset-y-0 left-0 bg-accent opacity-40" style={{ width: "100%" }} />
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: planned ? `${(done / planned) * 100}%` : "0%" }} />
        </div>
      </div>
      <span>
        {planned} of {budget} h
      </span>
    </div>
  );
}
