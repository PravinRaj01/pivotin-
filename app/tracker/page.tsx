"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppRow, RateBars } from "@/components/tracker-bits";
import { TransformBadge } from "@/components/TransformBadge";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import { fitFromRequirements } from "@/lib/fit";
import { useProfile } from "@/lib/profile-context";
import type { ApplicationInsightResult, ApplicationLogResult } from "@/lib/schemas/agents";
import type { JdResult } from "@/lib/schemas/jd";
import { MIN_GROUP, STATUS_LABEL, analyse, applyLog, funnel, insightInput, insightKey, setStatus, shapeInsights, trackerInput, type App, type Status } from "@/lib/tracker";

const today = () => new Date().toISOString().slice(0, 10);
const SHOW = 7;
const GROUPS: { title: string; hint: string; statuses: Status[] }[] = [
  { title: "Interviews and offers", hint: "The ones furthest along.", statuses: ["offer", "interview"] },
  { title: "Heard back", hint: "They replied; the next step is yours or theirs.", statuses: ["response"] },
  { title: "Waiting to hear", hint: "Applied, no news yet.", statuses: ["applied"] },
  { title: "Saved, not applied yet", hint: "Roles you plan to apply for.", statuses: ["saved"] },
  { title: "Closed", hint: "They said no.", statuses: ["rejected"] },
];

export default function TrackerPage() {
  const { profile, replace, update } = useProfile();
  const [text, setText] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<{ id: string; mode: "added" | "updated" } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainErr, setExplainErr] = useState("");
  const [more, setMore] = useState<Record<string, boolean>>({});

  const apps = profile.applications;
  const fun = useMemo(() => funnel(apps), [apps]);
  const an = useMemo(() => analyse(profile), [profile]);
  const insight = profile.applicationInsights;
  const stale = !!insight && insight.key !== insightKey(an);
  const freshRow = fresh ? apps.find((a) => a.id === fresh.id) : undefined;

  const log = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await callAgent<ApplicationLogResult>("application", trackerInput(profile, text, today()), { fresh: true });
      let pasted: number | null = null;
      if (jd.trim().length > 60) {
        const parsed = await callAgent<JdResult>("jd", { text: jd, roleHint: profile.goal.targetRole, existing: profile.targetRole.requirements.map((q) => q.label) });
        pasted = fitFromRequirements(profile, parsed.requirements.map((q) => ({ label: q.label, importance: q.importance })));
      }
      const out = applyLog(profile, r, today(), undefined, pasted);
      replace(out.profile);
      setFresh({ id: out.row.id, mode: out.mode });
      setText("");
      setJd("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy(false);
  };

  const explain = async () => {
    setExplainErr("");
    setExplaining(true);
    try {
      const r = await callAgent<ApplicationInsightResult>("analyst", insightInput(profile, an), { fresh: true });
      replace({ ...profile, applicationInsights: shapeInsights(profile, an, r, new Date().toISOString()) });
    } catch (e) {
      setExplainErr((e as Error).message || "Something went wrong.");
    }
    setExplaining(false);
  };

  const edit = (id: string, patch: Partial<App>) => update((p) => ({ ...p, applications: p.applications.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const remove = (id: string) => {
    if (confirm("Remove this application from your tracker?")) update((p) => ({ ...p, applications: p.applications.filter((a) => a.id !== id) }));
  };
  const addTarget = (role: string) =>
    update((p) => (p.goal.alternateRoles.some((r) => r.toLowerCase() === role.toLowerCase()) || p.goal.targetRole.toLowerCase() === role.toLowerCase() ? p : { ...p, goal: { ...p.goal, alternateRoles: [...p.goal.alternateRoles, role] } }));

  const toward = Math.min(an.total, MIN_GROUP);
  const pct = (e: number, n: number) => (n ? Math.round((100 * e) / n) : 0);
  const step = (label: string, n: number, of: number) => (
    <li className="flex-1 rounded-lg border border-border p-2 text-center">
      <p className="text-xl font-semibold">{n}</p>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent" style={{ width: `${of ? (n / of) * 100 : 0}%` }} />
      </div>
    </li>
  );

  return (
    <div>
      <ScreenHeader
        step={7}
        title="Application tracker"
        line="Tell me about each application out loud. I turn it into a row, keep your funnel, and once there are enough applications I tell you what is getting replies. I never read a pattern into fewer than 5."
      />

      <div className="flex flex-col gap-5">
        <Card title="Log an application" hint="Applied, heard back, got an interview, been turned down? Just say it. I add a new row, or update the one that is already there.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={'Click here and tell me about it with Wispr Flow. For example: "Applied to Swiggy through a referral yesterday with my version 2 resume."'}
            aria-label="Your application. Click here and tell me about it with Wispr Flow."
            className="w-full resize-y rounded-lg border border-border bg-bg p-4 text-base leading-relaxed outline-none focus:border-accent"
            disabled={busy}
          />
          <p className="mt-2 text-sm text-muted">
            Hold <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Fn</kbd> on a Mac or <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Ctrl + Win</kbd> on Windows, talk, then let go. Say the company, the role, how you applied and which resume if you can.
          </p>
          {text && <div className="mt-2"><TransformBadge text={text} /></div>}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">Optional: paste the job description for a fit score that is specific to this role</summary>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={4} placeholder="Paste the job description..." className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent" disabled={busy} />
          </details>
          {error && (
            <p className="mt-3 text-sm text-bad" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={log} disabled={busy || text.trim().length < 8}>
              {busy ? "Reading it..." : "Add this to my tracker"}
            </button>
            <button className={secondaryBtn} onClick={() => setText("Applied to Swiggy through a referral yesterday with my version 2 resume.")} disabled={busy}>
              Try an example
            </button>
          </div>
          {busy && <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface-2" aria-busy="true" />}
          {freshRow && (
            <div className="mt-4" role="status">
              <p className="text-sm font-medium">{fresh!.mode === "added" ? "Added to your tracker:" : "Updated in your tracker:"}</p>
              <ul className="mt-2">
                <AppRow app={freshRow} profile={profile} fresh onStatus={(s) => update((p) => setStatus(p, freshRow.id, s, today()))} onEdit={(patch) => edit(freshRow.id, patch)} onRemove={() => remove(freshRow.id)} />
              </ul>
            </div>
          )}
        </Card>

        <Card title="Where your applications stand" hint={`${fun.sent} sent${fun.saved ? `, ${fun.saved} saved for later` : ""}. ${fun.sent ? `${fun.engaged} of ${fun.sent} heard back (${pct(fun.engaged, fun.sent)}%).` : "Nothing sent yet."}`}>
          <ol className="flex gap-2" aria-label="Funnel">
            {step("Applied", fun.sent, fun.sent)}
            {step("Heard back", fun.engaged, fun.sent)}
            {step("Interview", fun.interview + fun.offer, fun.sent)}
            {step("Offer", fun.offer, fun.sent)}
          </ol>
          <p className="mt-2 text-xs text-muted">
            &ldquo;Heard back&rdquo; counts a response, an interview or an offer. A rejection on its own is not counted, because I do not know whether it followed a reply. {fun.rejected} rejected so far.
          </p>
        </Card>

        <Card title="What your applications are telling you" hint="Counted by code, never guessed. A pattern is only reported when each side has at least 5 applications and the gap is unlikely to be luck.">
          {an.total < MIN_GROUP ? (
            <div>
              <p className="text-sm">
                I will not say anything about patterns until you have sent at least {MIN_GROUP} applications. You have sent {an.total}.
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={toward} aria-valuemin={0} aria-valuemax={MIN_GROUP}>
                <div className="h-full bg-accent" style={{ width: `${(toward / MIN_GROUP) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div>
              <p className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">{an.confidence.label}</p>
              {an.patterns.length === 0 ? (
                <p className="mt-3 text-sm">No clear pattern yet. Nothing I could compare, with at least {MIN_GROUP} applications on each side, separates the applications that heard back from the rest.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {an.patterns.map((p) => (
                    <li key={p.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">
                        {p.dimensionLabel}: {p.value}{" "}
                        <span className="font-normal text-muted">
                          {p.direction === "higher" ? "hears back more often" : "hears back less often"}
                        </span>
                      </p>
                      <RateBars group={p.value} groupN={p.n} groupE={p.engaged} restN={p.restN} restE={p.restEngaged} label={`${p.value} compared with everything else`} />
                      <p className="mt-2 text-xs text-muted">
                        {p.engaged} of {p.n} against {p.restEngaged} of {p.restN}. The chance of a gap this big by luck alone is about {p.p < 0.01 ? "under 1" : Math.round(p.p * 100)}%.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">
                {an.comparisons} comparison{an.comparisons === 1 ? "" : "s"} could be made, so one standing out by chance is still possible.
                {an.tooSmall.length > 0 && ` Too few to compare yet: ${an.tooSmall.slice(0, 6).map((x) => `${x.value} (${x.n})`).join(", ")}.`}
              </p>

              {an.patterns.length > 0 && (
                <div className="mt-4">
                  {insight && !stale ? (
                    <div className="rounded-lg bg-accent-soft p-3">
                      <p className="text-sm font-semibold">{insight.headline}</p>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                        {insight.findings.map((f) => (
                          <li key={f.patternId}>{f.text}</li>
                        ))}
                      </ul>
                      {insight.suggestions.length > 0 && (
                        <>
                          <h3 className="mt-3 text-sm font-semibold">What you could change</h3>
                          <ul className="mt-1 flex flex-col gap-2">
                            {insight.suggestions.map((s, i) => (
                              <li key={i} className="rounded-lg bg-surface p-2.5 text-sm">
                                <span className="mr-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs">{s.kind === "target-role" ? "Target roles" : s.kind === "plan" ? "Your plan" : "Other"}</span>
                                {s.text}
                                {s.kind === "target-role" && s.role && (
                                  <button className={`${secondaryBtn} mt-2 block`} onClick={() => addTarget(s.role!)} disabled={profile.goal.alternateRoles.some((r) => r.toLowerCase() === s.role!.toLowerCase()) || profile.goal.targetRole.toLowerCase() === s.role.toLowerCase()}>
                                    {profile.goal.alternateRoles.some((r) => r.toLowerCase() === s.role!.toLowerCase()) ? `${s.role} is already a target role` : `Add ${s.role} to my target roles`}
                                  </button>
                                )}
                                {s.kind === "plan" && (
                                  <Link href="/plan" className="mt-2 block text-sm text-accent underline underline-offset-2">
                                    Open my plan
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {insight.caveat && <p className="mt-3 text-xs text-muted">{insight.caveat}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{stale ? "Your applications have changed since I last explained this." : "I can explain what this might mean and what you could change."}</p>
                  )}
                  {explainErr && (
                    <p className="mt-2 text-sm text-bad" role="alert">
                      {explainErr}
                    </p>
                  )}
                  <button className={`${insight && !stale ? secondaryBtn : primaryBtn} mt-3`} onClick={explain} disabled={explaining}>
                    {explaining ? "Thinking it through..." : insight && !stale ? "Explain it again" : "Explain what this means and what to change"}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {GROUPS.map((g) => {
          const rows = apps.filter((a) => g.statuses.includes(a.status));
          if (!rows.length) return null;
          const all = more[g.title];
          return (
            <Card key={g.title} title={`${g.title} (${rows.length})`} hint={g.hint}>
              <ul className="flex flex-col gap-2">
                {(all ? rows : rows.slice(0, SHOW)).map((a) => (
                  <AppRow key={a.id} app={a} profile={profile} fresh={fresh?.id === a.id} onStatus={(s) => update((p) => setStatus(p, a.id, s, today()))} onEdit={(patch) => edit(a.id, patch)} onRemove={() => remove(a.id)} />
                ))}
              </ul>
              {rows.length > SHOW && (
                <button className="mt-2 text-sm text-accent" onClick={() => setMore((m) => ({ ...m, [g.title]: !all }))}>
                  {all ? "Show fewer" : `Show all ${rows.length}`}
                </button>
              )}
            </Card>
          );
        })}

        {apps.length === 0 && (
          <Card title="Your applications" hint="Nothing here yet. Log your first one above.">
            <Chip>Try: &ldquo;Applied to a company through their careers page today with my version 1 resume.&rdquo;</Chip>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/wispr" className={`${primaryBtn} inline-block`}>
            Set up the Wispr Pro transform
          </Link>
          <span className="text-sm text-muted">Next: the last step, a ready-made transform for people on Wispr Pro.</span>
        </div>
      </div>
    </div>
  );
}
