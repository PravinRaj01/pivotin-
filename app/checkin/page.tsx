"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlanDiffView } from "@/components/checkin-bits";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { applyCheckin, checkinInput, checkinWeek, exampleWeek } from "@/lib/checkin";
import { callAgent } from "@/lib/client/agentClient";
import { toggleTask } from "@/lib/plan";
import { useProfile } from "@/lib/profile-context";
import { analyze, applyReplan, diffPlans, type PlanDiff, type Reflow } from "@/lib/replan";
import type { CheckinResult } from "@/lib/schemas/agents";

type Choice = "ontrack" | "drop" | "push" | null;
const STEPS = ["Tell me about your week", "Check what I understood", "Choose how to adjust"];

export default function CheckinPage() {
  const { profile, replace, update } = useProfile();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Choice>(null);
  const [dropId, setDropId] = useState("");
  const [result, setResult] = useState<{ weekN: number; summary: string; diff: PlanDiff; before: [string | undefined, number, number]; after: [string | undefined, number, number] } | null>(null);

  const g = profile.goal;
  const labels = new Map(profile.skills.map((s) => [s.id, s.label]));
  // A check-in that has been logged but not yet decided on keeps the screen on its week, even if ticking moves the plan on.
  const pending = [...profile.checkins].reverse().find((c) => c.planAdjustments.length === 0);
  const weekN = pending ? pending.weekN : checkinWeek(profile);
  const week = profile.plan.weeks.find((w) => w.n === weekN);
  const hasPlan = profile.plan.weeks.length > 0;
  const hoursNow = pending?.parsed.hoursPerWeekFromNow ?? g.hoursPerWeek;
  const analysis = useMemo(() => (pending ? analyze(profile, pending.weekN, hoursNow) : null), [profile, pending, hoursNow]);

  const dropOpt = analysis?.drops.find((d) => d.skillId === (dropId || analysis.drops[0]?.skillId));
  const chosen: Reflow | null =
    !analysis ? null : !analysis.behind ? analysis.base : choice === "push" ? (analysis.push?.reflow ?? null) : choice === "drop" ? (dropOpt?.reflow ?? null) : null;
  const preview = useMemo(() => {
    if (!chosen) return null;
    const after = applyReplan(profile, chosen, "", "", new Date().toISOString());
    return { diff: diffPlans(profile.plan.weeks, after.plan.weeks), after };
  }, [profile, chosen]);

  const log = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await callAgent<CheckinResult>("checkin", checkinInput(profile, weekN, text), { fresh: true });
      replace(applyCheckin(profile, weekN, r, text.trim(), new Date().toISOString()).profile);
      setText("");
      setChoice(null);
      setResult(null);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy(false);
  };

  const setHours = (v: number) =>
    update((p) => ({ ...p, checkins: p.checkins.map((c) => (c.id === pending?.id ? { ...c, parsed: { ...c.parsed, hoursSpent: Math.max(0, Math.min(80, v)) } } : c)) }));

  const finish = (summary: string, next = profile) => {
    if (!pending) return;
    replace({ ...next, checkins: next.checkins.map((c) => (c.id === pending.id ? { ...c, planAdjustments: [summary] } : c)) });
    setChoice(null);
  };

  const apply = () => {
    if (!pending || !chosen || !analysis || !preview) return;
    const carried = preview.diff.carried;
    const summary = !analysis.behind
      ? `Week ${weekN}: ${carried ? `${carried} unfinished task${carried > 1 ? "s" : ""} carried into the weeks ahead` : "everything done, no change"}. Deadline unchanged.`
      : choice === "push"
        ? `Week ${weekN}: pushed the deadline ${analysis.push!.weeks} week${analysis.push!.weeks > 1 ? "s" : ""}${analysis.push!.deadline ? ` to ${analysis.push!.deadline}` : ""}; ${carried} unfinished task${carried === 1 ? "" : "s"} carried over, nothing dropped.`
        : `Week ${weekN}: dropped ${dropOpt!.label} (${dropOpt!.tasks} task${dropOpt!.tasks > 1 ? "s" : ""}, ${dropOpt!.hours} h) to fit your hours; ${carried} unfinished task${carried === 1 ? "" : "s"} carried over.`;
    const next = applyReplan(profile, chosen, summary, `Check-in, week ${weekN}`, new Date().toISOString());
    setResult({
      weekN,
      summary,
      diff: preview.diff,
      before: [g.deadline, profile.plan.weeks.length, g.hoursPerWeek],
      after: [next.goal.deadline, next.plan.weeks.length, next.goal.hoursPerWeek],
    });
    finish(summary, next);
  };

  const stage = pending ? 3 : 1;
  const logged = pending?.parsed.hoursSpent ?? 0;
  const planned = pending?.parsed.plannedHours ?? week?.hours ?? 0;
  const stepClass = (i: number) => (i + 1 === stage || (stage === 3 && i === 1) ? "border-accent bg-accent-soft text-text" : "border-border");
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

  return (
    <div>
      <ScreenHeader
        step={6}
        title="Weekly check-in"
        line="Tell me how your week went: what you finished, what you skipped, your hours and what got in the way. I tick off your tasks, log the hours, and re-plan the rest of the weeks."
      />

      <ol className="mb-5 flex gap-2 text-xs text-muted" aria-label="Progress on this screen">
        {STEPS.map((l, i) => (
          <li key={l} className={`flex-1 rounded-lg border px-3 py-2 ${stepClass(i)}`}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-5">
        {!hasPlan ? (
          <Card title="Your check-in" hint="A check-in compares your week with your plan, so I need a plan first.">
            <Link href="/plan" className={`${primaryBtn} inline-block`}>
              Build my plan first
            </Link>
          </Card>
        ) : (
          <>
            {result && (
              <Card title={`Week ${result.weekN} is logged and your plan is updated`} hint={result.summary}>
                <PlanDiffView diff={result.diff} hoursBefore={result.before[2]} hoursAfter={result.after[2]} deadlineBefore={result.before[0]} deadlineAfter={result.after[0]} weeksBefore={result.before[1]} weeksAfter={result.after[1]} />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/plan" className={`${primaryBtn} inline-block`}>
                    See my updated plan
                  </Link>
                  <button className={secondaryBtn} onClick={() => setResult(null)}>
                    Close
                  </button>
                </div>
              </Card>
            )}

            {!pending && week && (
              <Card title={`Week ${weekN}: ${week.theme}`} hint={`${week.hours} of your ${g.hoursPerWeek} hours were planned. Press your Wispr Flow key and just talk.`}>
                <ul className="mb-3 divide-y divide-border rounded-lg border border-border">
                  {week.tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className={t.status === "done" ? "text-muted line-through" : ""}>{t.title}</span>
                      <span className="shrink-0 text-xs text-muted">{t.estHours} h</span>
                    </li>
                  ))}
                </ul>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Click here and tell me about your week with Wispr Flow."
                  aria-label="About your week. Click here and tell me about your week with Wispr Flow."
                  className="w-full resize-y rounded-lg border border-border bg-bg p-4 text-base leading-relaxed outline-none focus:border-accent"
                  disabled={busy}
                />
                <p className="mt-2 text-sm text-muted">
                  Hold <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Fn</kbd> on a Mac or{" "}
                  <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Ctrl + Win</kbd> on Windows, talk, then let go.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">Good to mention:</span>
                  {["What you finished", "What you skipped", "Hours you worked", "What got in the way"].map((x) => (
                    <Chip key={x}>{x}</Chip>
                  ))}
                </div>
                {error && (
                  <p className="mt-3 text-sm text-bad" role="alert">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className={primaryBtn} onClick={log} disabled={busy || text.trim().length < 15}>
                    {busy ? "Reading your week..." : "Log my week and tick off my tasks"}
                  </button>
                  <button className={secondaryBtn} onClick={() => setText(exampleWeek(profile, weekN, "partial"))} disabled={busy}>
                    Try an example: a mixed week
                  </button>
                  <button className={secondaryBtn} onClick={() => setText(exampleWeek(profile, weekN, "rough"))} disabled={busy}>
                    Try an example: a lost week
                  </button>
                </div>
                {busy && (
                  <div className="mt-4 space-y-2" aria-busy="true">
                    {[75, 55, 65].map((w, i) => (
                      <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {pending && week && analysis && (
              <>
                <Card title="What I understood" hint="Fix anything that is wrong: tick or untick a task, or change the hours. The re-plan below follows what you set here.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-lg border border-border p-3" aria-label="Hours">
                      <h3 className="text-sm font-semibold">Hours this week</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={80}
                          step={0.5}
                          value={logged}
                          onChange={(e) => setHours(Number(e.target.value))}
                          className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent"
                          aria-label="Hours worked this week"
                        />
                        <span className="text-sm text-muted">of {planned} planned</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={logged} aria-valuemin={0} aria-valuemax={Math.max(planned, 1)}>
                        <div className={`h-full ${logged >= planned ? "bg-good" : "bg-accent"}`} style={{ width: `${Math.min(100, (logged / Math.max(planned, 1)) * 100)}%` }} />
                      </div>
                      {logged === 0 && <p className="mt-2 text-xs text-muted">You did not say how many hours. Type them in if you like.</p>}
                      {pending.parsed.hoursPerWeekFromNow && (
                        <p className="mt-2 rounded-lg bg-accent-soft p-2 text-xs">
                          You said you can now give {pending.parsed.hoursPerWeekFromNow} hours a week, not {g.hoursPerWeek}. The re-plan below uses that.
                        </p>
                      )}
                    </section>
                    <section className="rounded-lg border border-border p-3" aria-label="What got in the way">
                      <h3 className="text-sm font-semibold">What got in the way</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">{pending.parsed.blockers.length ? pending.parsed.blockers.map((b) => <Chip key={b}>{b}</Chip>) : <span className="text-sm text-muted">Nothing you mentioned</span>}</div>
                      {pending.parsed.wins.length > 0 && (
                        <>
                          <h3 className="mt-3 text-sm font-semibold">What went well</h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">{pending.parsed.wins.map((b) => <Chip key={b}>{b}</Chip>)}</div>
                        </>
                      )}
                    </section>
                  </div>
                  <ul className="mt-4 divide-y divide-border rounded-lg border border-border" aria-label={`Week ${weekN} tasks`}>
                    {week.tasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                        <input type="checkbox" checked={t.status === "done"} onChange={() => update((p) => toggleTask(p, t.id))} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`Done: ${t.title}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {t.estHours} h
                            {t.status === "skipped" && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5">You skipped this</span>}
                            {t.status === "todo" && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5">Not done</span>}
                            {t.skillIds[0] && <span className="ml-2">{labels.get(t.skillIds[0])}</span>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {pending.parsed.coachMessage && <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm">{pending.parsed.coachMessage}</p>}
                </Card>

                <Card
                  title={analysis.behind ? "You are behind: here is the trade-off" : analysis.base.unchanged ? "You are on track" : "You are on track: here is the change"}
                  hint={
                    analysis.behind
                      ? `${analysis.base.needHours} hours of work are left and your weeks ahead have room for ${analysis.base.capacityHours} at ${analysis.hoursPerWeek} hours a week. About ${Math.ceil(analysis.base.droppedHours)} hours do not fit. Pick one way to close the gap.`
                      : `${analysis.unfinishedHours} hours from this week and earlier are still to do. They fit in the weeks ahead without dropping anything or moving your deadline.`
                  }
                >
                  {analysis.behind ? (
                    <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="How to close the gap">
                      <div className={`rounded-lg border p-3 ${choice === "drop" ? "border-accent bg-accent-soft" : "border-border"}`}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="radio" name="opt" checked={choice === "drop"} onChange={() => setChoice("drop")} className="mt-1 accent-[var(--accent)]" />
                          <span>
                            <span className="block text-sm font-semibold">Drop a topic</span>
                            <span className="block text-xs text-muted">Keep your deadline. You will not learn the topic you drop.</span>
                          </span>
                        </label>
                        <label className="mt-3 block text-xs text-muted" htmlFor="dropTopic">
                          Which topic?
                        </label>
                        <select
                          id="dropTopic"
                          value={dropOpt?.skillId ?? ""}
                          onChange={(e) => {
                            setDropId(e.target.value);
                            setChoice("drop");
                          }}
                          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
                        >
                          {analysis.drops.map((d) => (
                            <option key={d.skillId} value={d.skillId}>
                              {d.label} ({d.hours} h)
                            </option>
                          ))}
                        </select>
                        {dropOpt && (
                          <p className="mt-2 text-xs">
                            Asked for in {Math.round(dropOpt.share * 100)}% of the job descriptions, the {analysis.drops[0]?.skillId === dropOpt.skillId ? "fewest of what is left" : "topic you picked"}.{" "}
                            {dropOpt.reflow.droppedHours - dropOpt.hours > 0.5
                              ? `Dropping it frees ${dropOpt.hours} h, but ${Math.round((dropOpt.reflow.droppedHours - dropOpt.hours) * 2) / 2} h more would still not fit.`
                              : "Everything else then fits."}
                          </p>
                        )}
                      </div>
                      <div className={`rounded-lg border p-3 ${choice === "push" ? "border-accent bg-accent-soft" : "border-border"}`}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="radio" name="opt" checked={choice === "push"} onChange={() => setChoice("push")} className="mt-1 accent-[var(--accent)]" />
                          <span>
                            <span className="block text-sm font-semibold">
                              Push your deadline {analysis.push!.weeks} week{analysis.push!.weeks > 1 ? "s" : ""}
                            </span>
                            <span className="block text-xs text-muted">Keep every topic. It takes longer to be ready.</span>
                          </span>
                        </label>
                        <p className="mt-3 text-xs">
                          {analysis.push!.deadline ? `New deadline: ${fmt(analysis.push!.deadline)} (was ${fmt(g.deadline)}). ` : ""}
                          {analysis.push!.fits ? `Your plan grows from ${profile.plan.weeks.length} to ${profile.plan.weeks.length + analysis.push!.weeks} weeks and nothing is dropped.` : `Even ${analysis.push!.weeks} more weeks would not fit all of it, so some work would still be dropped. Consider dropping a topic too.`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{preview?.diff.carried ? `${preview.diff.carried} unfinished task${preview.diff.carried > 1 ? "s" : ""} will be carried into later weeks.` : "Nothing needs to move."}</p>
                  )}
                </Card>

                {chosen && preview && (
                  <Card title="Your plan, before and after" hint="Only the weeks that change are shown. Tasks tinted on the After side are new or moved.">
                    <PlanDiffView diff={preview.diff} hoursBefore={g.hoursPerWeek} hoursAfter={chosen.hoursPerWeek} deadlineBefore={g.deadline} deadlineAfter={preview.after.goal.deadline} weeksBefore={profile.plan.weeks.length} weeksAfter={preview.after.plan.weeks.length} />
                  </Card>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button className={primaryBtn} onClick={apply} disabled={!chosen}>
                    {!analysis.behind ? "Update my plan" : choice === "push" ? "Push my deadline and update my plan" : choice === "drop" ? `Drop ${dropOpt?.label ?? "the topic"} and update my plan` : "Choose an option above"}
                  </button>
                  <button className={secondaryBtn} onClick={() => finish("Logged only; the plan was not changed.")}>
                    Log this week without changing the plan
                  </button>
                </div>
              </>
            )}

            {profile.checkins.filter((c) => c.id !== pending?.id).length > 0 && (
              <Card title="Earlier check-ins" hint="Hours you logged against the plan, newest first.">
                <ol className="divide-y divide-border">
                  {[...profile.checkins]
                    .filter((c) => c.id !== pending?.id)
                    .reverse()
                    .slice(0, 6)
                    .map((c) => (
                      <li key={c.id} className="py-2.5">
                        <details>
                          <summary className="cursor-pointer text-sm">
                            <span className="font-medium">Week {c.weekN}</span>
                            <span className="ml-2 text-muted">
                              {c.parsed.hoursSpent} of {c.parsed.plannedHours ?? "?"} h, {c.parsed.completedTaskIds.length} task{c.parsed.completedTaskIds.length === 1 ? "" : "s"} done
                            </span>
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{c.transcript}</p>
                          {c.parsed.blockers.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{c.parsed.blockers.map((b) => <Chip key={b}>{b}</Chip>)}</div>}
                          {c.planAdjustments.map((a) => (
                            <p key={a} className="mt-2 text-sm">
                              {a}
                            </p>
                          ))}
                        </details>
                      </li>
                    ))}
                </ol>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
