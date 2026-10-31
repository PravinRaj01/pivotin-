"use client";

import { useState } from "react";
import type { DiffItem, PlanDiff } from "@/lib/replan";

// Before: what was planned, with a note on where a task goes. After: what it is now; tinted means new or moved here,
// struck through means it has left this week.
function Item({ i, side }: { i: DiffItem; side: "before" | "after" }) {
  const left = side === "after" && (i.change === "moved-out" || i.change === "dropped");
  const style = left ? "text-muted line-through" : side === "after" && i.change !== "same" ? "bg-accent-soft" : "text-muted";
  const noteStyle = side === "before" && i.change === "dropped" ? "text-bad" : side === "before" && i.change !== "same" ? "text-accent" : "";
  return (
    <li className={`rounded px-2 py-1.5 text-sm ${style}`}>
      <span>{i.task.title}</span>
      <span className={`ml-1.5 whitespace-nowrap text-xs no-underline ${noteStyle}`}>
        ({i.task.estHours} h{i.note ? `, ${i.note}` : ""})
      </span>
    </li>
  );
}

// The plan before and after a change, week by week. Only weeks that changed are listed.
export function PlanDiffView({ diff, hoursBefore, hoursAfter, deadlineBefore, deadlineAfter, weeksBefore, weeksAfter }: {
  diff: PlanDiff;
  hoursBefore: number;
  hoursAfter: number;
  deadlineBefore?: string;
  deadlineAfter?: string;
  weeksBefore: number;
  weeksAfter: number;
}) {
  const [all, setAll] = useState(false);
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "no date set");
  const list = all ? diff.weeks : diff.weeks.slice(0, 5);
  const facts = [
    deadlineBefore !== deadlineAfter || weeksBefore !== weeksAfter ? `Deadline: ${fmt(deadlineBefore)} to ${fmt(deadlineAfter)} (${weeksBefore} to ${weeksAfter} weeks)` : "Deadline stays the same",
    hoursBefore !== hoursAfter ? `Hours a week: ${hoursBefore} to ${hoursAfter}` : `${hoursAfter} hours a week`,
  ];
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {facts.map((f) => (
          <li key={f} className="rounded-full bg-surface-2 px-2.5 py-1">
            {f}
          </li>
        ))}
        {diff.carried > 0 && <li className="rounded-full bg-accent-soft px-2.5 py-1">{diff.carried} unfinished task{diff.carried > 1 ? "s" : ""} carried over</li>}
        {diff.moved > 0 && <li className="rounded-full bg-accent-soft px-2.5 py-1">{diff.moved} later task{diff.moved > 1 ? "s" : ""} shifted to make room</li>}
        {diff.dropped > 0 && <li className="rounded-full px-2.5 py-1 text-bad">{diff.dropped} task{diff.dropped > 1 ? "s" : ""} dropped</li>}
        {diff.newWeeks > 0 && <li className="rounded-full bg-accent-soft px-2.5 py-1">{diff.newWeeks} week{diff.newWeeks > 1 ? "s" : ""} added</li>}
      </ul>

      {diff.weeks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing in the weeks ahead changes.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {list.map((w) => (
            <li key={w.n} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">
                Week {w.n}
                {w.isNew && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-normal">new week</span>}
                <span className="ml-2 text-xs font-normal text-muted">
                  {w.hoursBefore} h to {w.hoursAfter} h
                </span>
              </p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <section aria-label={`Week ${w.n} before`}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Before</h4>
                  <ul className="mt-1 flex flex-col gap-1">{w.before.length ? w.before.map((i) => <Item key={i.task.id} i={i} side="before" />) : <li className="px-2 text-sm text-muted">Nothing</li>}</ul>
                </section>
                <section aria-label={`Week ${w.n} after`}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">After</h4>
                  <ul className="mt-1 flex flex-col gap-1">{w.after.length ? w.after.map((i) => <Item key={i.task.id} i={i} side="after" />) : <li className="px-2 text-sm text-muted">Nothing</li>}</ul>
                </section>
              </div>
            </li>
          ))}
        </ol>
      )}
      {diff.weeks.length > 5 && (
        <button className="mt-2 text-sm text-accent" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer weeks" : `Show all ${diff.weeks.length} changed weeks`}
        </button>
      )}
    </div>
  );
}
