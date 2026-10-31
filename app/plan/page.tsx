"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import { applyPlan, currentWeek, planInput, planProgress, toggleTask } from "@/lib/plan";
import { useProfile } from "@/lib/profile-context";
import { PlanResult } from "@/lib/schemas/plan";
import { PivotProfile } from "@/lib/types";

type Week = PivotProfile["plan"]["weeks"][number];

function TaskItem({ t, labels, onToggle }: { t: Week["tasks"][number]; labels: Map<string, string>; onToggle: () => void }) {
  const done = t.status === "done";
  return (
    <li className="flex gap-3 py-2.5">
      <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`Mark done: ${t.title}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-muted line-through" : ""}`}>{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{t.estHours}h</span>
          {t.skillIds.slice(0, 2).map((id) => (
            <Chip key={id}>{labels.get(id) ?? id}</Chip>
          ))}
          {t.resourceHint && !done && <span>- {t.resourceHint}</span>}
        </div>
      </div>
    </li>
  );
}

export default function PlanPage() {
  const { profile, update, replace } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [why, setWhy] = useState("");

  const labels = new Map(profile.skills.map((s) => [s.id, s.label]));
  const weeks = profile.plan.weeks;
  const has = weeks.length > 0;
  const now = currentWeek(profile);
  const prog = planProgress(profile);
  const thisWeek = weeks.find((w) => w.n === now);

  const build = async () => {
    setError("");
    setBusy(true);
    try {
      const from = has ? now : 1;
      const reason = has ? why.trim() || "Refresh the remaining weeks" : "First plan";
      const r = await callAgent<PlanResult>("plan", planInput(profile, from, reason), { fresh: has });
      replace(applyPlan(profile, r, from, reason));
      setWhy("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy(false);
  };

  const toggle = (id: string) => update((p) => toggleTask(p, id));

  // At most 6 phases so the list never gets long (Miller's law).
  const size = Math.max(1, Math.ceil(weeks.length / 6));
  const phases: Week[][] = [];
  for (let i = 0; i < weeks.length; i += size) phases.push(weeks.slice(i, i + size));

  return (
    <div>
      <ScreenHeader
        step={3}
        title="Weekly plan"
        line={`${profile.goal.timelineWeeks} weeks at ${profile.goal.hoursPerWeek} hours a week, built around your biggest gaps. Tick tasks off as you finish them.`}
      />

      <div className="flex flex-col gap-5">
        {!profile.skills.length ? (
          <Card title="Your plan" hint="The plan is built from your skill gaps, so it needs the skill map first.">
            <Link href="/skills" className={`${primaryBtn} inline-block`}>
              Build my Skill bridge first
            </Link>
          </Card>
        ) : (
          <Card
            title={has ? "Your plan at a glance" : "Build your plan"}
            hint={has ? undefined : "One click turns your gaps into weeks of specific tasks. It takes about 20 seconds."}
          >
            {has && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Week {Math.min(now, weeks.length)} of {profile.goal.timelineWeeks}
                  </span>
                  <span className="text-muted">
                    {prog.done} of {prog.total} tasks done ({prog.pct}%)
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-all" style={{ width: `${prog.pct}%` }} />
                </div>
              </div>
            )}
            {has && (
              <input
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Optional: what changed? (e.g. I can only do 5 hours a week now)"
                className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                disabled={busy}
              />
            )}
            {error && (
              <p className="mb-3 text-sm text-bad" role="alert">
                {error}
              </p>
            )}
            <button className={has ? secondaryBtn : primaryBtn} onClick={build} disabled={busy}>
              {busy ? "Writing your plan..." : has ? `Re-plan weeks ${now} to ${profile.goal.timelineWeeks}` : `Build my ${profile.goal.timelineWeeks}-week plan`}
            </button>
            {busy && <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface-2" aria-busy="true" />}
          </Card>
        )}

        {has && thisWeek && (
          <Card title={`This week: ${thisWeek.theme}`} hint={`Week ${thisWeek.n}, ${thisWeek.hours} of ${profile.goal.hoursPerWeek} hours planned.`}>
            <ul className="divide-y divide-border">
              {thisWeek.tasks.map((t) => (
                <TaskItem key={t.id} t={t} labels={labels} onToggle={() => toggle(t.id)} />
              ))}
            </ul>
          </Card>
        )}

        {has && !thisWeek && (
          <Card title="Plan complete" hint="Every task is done. Re-plan to add more weeks, or move to interviews and applications.">
            <Link href="/interview" className={`${primaryBtn} inline-block`}>
              Practise a mock interview
            </Link>
          </Card>
        )}

        {has && (
          <Card title="All weeks" hint="Grouped into phases. Open one to see its weeks.">
            <div className="flex flex-col gap-2">
              {phases.map((ph) => {
                const tasks = ph.flatMap((w) => w.tasks);
                const done = tasks.filter((t) => t.status === "done").length;
                const isCurrent = ph.some((w) => w.n === now);
                return (
                  <details key={ph[0].n} open={isCurrent} className="rounded-lg border border-border">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="font-medium">
                        {ph.length > 1 ? `Weeks ${ph[0].n}-${ph[ph.length - 1].n}` : `Week ${ph[0].n}`}
                        <span className="ml-2 font-normal text-muted">{ph[0].theme}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {done}/{tasks.length}
                      </span>
                    </summary>
                    <div className="border-t border-border px-3 pb-2">
                      {ph.map((w) => (
                        <div key={w.n} className="pt-3">
                          <p className="text-sm font-medium">
                            Week {w.n}: {w.theme} <span className="font-normal text-muted">({w.hours}h)</span>
                          </p>
                          <ul className="divide-y divide-border">
                            {w.tasks.map((t) => (
                              <TaskItem key={t.id} t={t} labels={labels} onToggle={() => toggle(t.id)} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
        )}

        {profile.plan.changelog.length > 0 && (
          <Card title="What changed in your plan" hint="Every re-plan is logged here, newest first.">
            <ul className="divide-y divide-border">
              {profile.plan.changelog.slice(0, 5).map((c) => (
                <li key={c.at} className="py-2.5 text-sm">
                  <p className="text-xs text-muted">
                    {new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} - {c.reason}
                  </p>
                  <p className="mt-0.5">{c.summary}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {has && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/projects" className={`${primaryBtn} inline-block`}>
              Pick my portfolio project
            </Link>
            <span className="text-sm text-muted">Next: proof of work that backs up the plan.</span>
          </div>
        )}
      </div>
    </div>
  );
}
