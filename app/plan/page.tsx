"use client";

import Link from "next/link";
import { useState } from "react";
import { HoursBar, TaskItem, type Week } from "@/components/plan-bits";
import { Card, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import { currentWeek, planProgress, toggleTask } from "@/lib/plan";
import { buildPlan, type Step } from "@/lib/plan-run";
import { weeksAvailable } from "@/lib/planner";
import { useProfile } from "@/lib/profile-context";

const today = () => new Date().toISOString().slice(0, 10);

export default function PlanPage() {
  const { profile, update, replace } = useProfile();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ label: "", pct: 0 });
  const [error, setError] = useState("");
  const [why, setWhy] = useState("");

  const g = profile.goal;
  const labels = new Map(profile.skills.map((s) => [s.id, s.label]));
  const weeks = profile.plan.weeks;
  const has = weeks.length > 0;
  const needsGoal = !g.hoursPerWeek || (!g.timelineWeeks && !g.deadline);
  const now = currentWeek(profile);
  const prog = planProgress(profile);
  const total = needsGoal ? 0 : weeksAvailable(profile, today()) || g.timelineWeeks;
  const projectTitle = (id?: string) => profile.projects.find((p) => p.id === id)?.title;

  const run = async () => {
    setError("");
    setBusy(true);
    setStep({ label: "Starting", pct: 2 });
    try {
      const from = has ? Math.min(now, weeks.length) : 1;
      const reason = has ? why.trim() || `Re-plan from week ${from}` : "First plan";
      const next = await buildPlan(profile, { fromWeek: from, reason, today: today(), call: (route, input) => callAgent(route, input), onStep: setStep });
      replace(next);
      setWhy("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy(false);
  };

  const toggle = (id: string) => update((p) => toggleTask(p, id));

  // Blocks of 2 or 3 weeks, each ending in a project milestone. The closing weeks are their own block.
  const blocks: Week[][] = [];
  for (const w of weeks) {
    const last = blocks[blocks.length - 1];
    if (last && last[0].block === w.block) last.push(w);
    else blocks.push([w]);
  }
  const blockMilestone = (b: Week[]) => b.flatMap((w) => w.tasks).find((t) => t.kind === "milestone");
  const uncovered = (profile.plan.uncovered ?? []).map((id) => profile.skills.find((s) => s.id === id)).filter(Boolean);
  const currentBlock = blocks.findIndex((b) => b.some((w) => w.n === now));

  return (
    <div>
      <ScreenHeader
        step={3}
        title="Weekly plan"
        line={
          needsGoal
            ? "Tell me how many hours a week you have and by when, then I can build your plan."
            : `${total} weeks at ${g.hoursPerWeek} hours a week. Skills that more job descriptions ask for come first, and a skill never comes before the one it builds on.`
        }
      />

      <div className="flex flex-col gap-5">
        {needsGoal && !has ? (
          <Card title="Your plan" hint="I do not guess your hours or deadline. Add them in your story and the plan will fit them.">
            <Link href="/intake" className={`${primaryBtn} inline-block`}>
              Add my hours and deadline
            </Link>
          </Card>
        ) : !profile.skills.length ? (
          <Card title="Your plan" hint="The plan is built from your skill gaps, so it needs the skill map first.">
            <Link href="/skills" className={`${primaryBtn} inline-block`}>
              Build my Skill bridge first
            </Link>
          </Card>
        ) : (
          <Card
            title={has ? "Your plan at a glance" : "Build your plan"}
            hint={has ? undefined : "One click works out what to learn first, picks your portfolio projects, and writes every week. It takes about a minute."}
          >
            {has && (
              <div className="mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    Week {Math.min(now, weeks.length)} of {weeks.length}
                  </span>
                  <span className="text-muted">
                    {prog.done} of {prog.total} tasks done ({prog.pct}%), {prog.hoursDone} of {prog.hours} hours
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${prog.pct}%` }} />
                </div>
              </div>
            )}
            {has && !busy && (
              <input
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Optional: what changed? (for example: I lost two weeks to work)"
                className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            )}
            {error && (
              <p className="mb-3 text-sm text-bad" role="alert">
                {error}
              </p>
            )}
            <button className={has ? secondaryBtn : primaryBtn} onClick={run} disabled={busy}>
              {busy ? "Building your plan..." : has ? `Re-plan weeks ${Math.min(now, weeks.length)} to ${weeks.length}` : `Build my ${total}-week plan`}
            </button>
            {busy && (
              <div className="mt-4" aria-live="polite">
                <div className="flex justify-between text-xs text-muted">
                  <span>{step.label}</span>
                  <span>{step.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-all" style={{ width: `${step.pct}%` }} />
                </div>
              </div>
            )}
          </Card>
        )}

        {has && (
          <Card title="Timeline" hint="Each square is a week. A dot marks a week that ends a block with a project milestone.">
            <ol className="flex flex-wrap gap-1" aria-label="Weeks at a glance">
              {weeks.map((w) => {
                const allDone = w.tasks.length > 0 && w.tasks.every((t) => t.status === "done");
                const someDone = w.tasks.some((t) => t.status === "done");
                const isNow = w.n === now;
                const hasMs = w.tasks.some((t) => t.kind === "milestone");
                return (
                  <li
                    key={w.n}
                    title={`Week ${w.n}: ${w.theme}${hasMs ? " (project milestone)" : ""}`}
                    className={`relative grid h-7 w-7 place-items-center rounded text-[10px] ${
                      allDone ? "bg-accent text-accent-text" : someDone ? "bg-accent-soft" : "bg-surface-2 text-muted"
                    } ${isNow ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                  >
                    {w.n}
                    {hasMs && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface bg-warn" aria-hidden />}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted">
              Dark square: done. Ring: this week. Tinted: started.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {blocks.map((b, bi) => {
                const tasks = b.flatMap((w) => w.tasks);
                const done = tasks.filter((t) => t.status === "done").length;
                const ms = blockMilestone(b);
                const wrap = b[0].wrap;
                return (
                  <details key={bi} open={bi === currentBlock || (currentBlock < 0 && bi === 0)} className="rounded-lg border border-border">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">
                          {wrap ? "Closing weeks" : `Block ${bi + 1}`}, {b.length > 1 ? `weeks ${b[0].n} to ${b[b.length - 1].n}` : `week ${b[0].n}`}
                        </span>
                        {!wrap && ms && <span className="block text-xs text-muted">Ends with: {ms.title}</span>}
                        {wrap && <span className="block text-xs text-muted">Interviews, portfolio polish and applications</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {done}/{tasks.length} done
                      </span>
                    </summary>
                    <ol className="border-t border-border px-3 pb-2">
                      {b.map((w) => {
                        const planned = w.tasks.reduce((s, t) => s + t.estHours, 0);
                        const doneH = w.tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.estHours, 0);
                        return (
                          <li key={w.n} className={`border-l-2 pl-3 pt-3 ${w.n === now ? "border-accent" : "border-border"}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                Week {w.n}: {w.theme}
                                {w.n === now && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-normal text-accent-text">This week</span>}
                              </p>
                              <HoursBar planned={Math.round(planned * 10) / 10} done={doneH} budget={g.hoursPerWeek} />
                            </div>
                            <ul className="divide-y divide-border">
                              {w.tasks.map((t) => (
                                <TaskItem key={t.id} t={t} labels={labels} projectTitle={projectTitle(t.projectId)} onToggle={() => toggle(t.id)} />
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                );
              })}
            </div>
          </Card>
        )}

        {has && uncovered.length > 0 && (
          <Card
            title={`Not in this plan (${uncovered.length})`}
            hint={`These skill gaps did not fit in ${weeks.length} weeks at ${g.hoursPerWeek} hours a week. They are the ones fewest job descriptions ask for. Add hours or weeks and re-plan to fit more.`}
          >
            <details>
              <summary className="cursor-pointer text-sm text-muted">Show the skills</summary>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {uncovered.slice(0, 20).map((s) => (
                  <li key={s!.id}>{s!.label}</li>
                ))}
              </ul>
            </details>
          </Card>
        )}

        {profile.plan.changelog.length > 0 && (
          <Card title="What changed in your plan" hint="Every build and re-plan is logged here, newest first.">
            <ul className="divide-y divide-border">
              {profile.plan.changelog.slice(0, 4).map((c) => (
                <li key={c.at + c.reason} className="py-2.5 text-sm">
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
              See my portfolio projects
            </Link>
            <span className="text-sm text-muted">Next: the {profile.projects.length || "2 or 3"} projects behind your milestones, and the story each gives you.</span>
          </div>
        )}
      </div>
    </div>
  );
}
