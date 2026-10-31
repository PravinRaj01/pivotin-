"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import { applyIntake, chooseRole } from "@/lib/intake";
import { useProfile } from "@/lib/profile-context";
import { IntakeResult } from "@/lib/schemas/intake";
import { TransformBadge } from "@/components/TransformBadge";
import { teacher } from "@/lib/seeds/teacher";

type Phase = "write" | "reading" | "review";

const DISTANCE = { close: "Closest move", stretch: "A stretch", leap: "A big leap" } as const;
const KIND = { dislike: "Avoid", like: "Enjoys", value: "Values", limit: "Limit", other: "Note" } as const;
const GOOD_TO_MENTION = ["Your work now", "Where you want to go", "Hours a week and a deadline", "Pay and places"];

const today = () => new Date().toISOString().slice(0, 10);

// Rows appear one at a time once the answer arrives (no streaming: cheap, but it feels alive).
function Row({ label, show, missing, children }: { label: string; show: boolean; missing?: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="pop-in grid gap-0.5 py-2 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{missing ? <span className="text-muted">Not said yet</span> : children}</dd>
    </div>
  );
}

const chips = (xs: string[]) => <span className="flex flex-wrap gap-1.5">{xs.slice(0, 6).map((x) => <Chip key={x}>{x}</Chip>)}</span>;

export default function IntakePage() {
  const { profile, update, replace, ready } = useProfile();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("write");
  const [shown, setShown] = useState(99); // 99 = everything visible (page opened, not just analysed)
  const [error, setError] = useState("");

  const last = profile.story.rawTranscripts.at(-1)?.text ?? "";
  useEffect(() => {
    if (ready) setText(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile.id]);

  useEffect(() => {
    if (shown >= 40) return;
    const t = setTimeout(() => setShown((n) => n + 1), 110);
    return () => clearTimeout(t);
  }, [shown]);

  const run = async (transcript: string) => {
    setError("");
    setPhase("reading");
    try {
      const r = await callAgent<IntakeResult>("intake", { transcript, today: today() });
      update((p) => applyIntake(p, r, transcript, today()));
      setText(transcript);
      setAnswer("");
      setShown(0);
      setPhase("review");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setPhase("write");
    }
  };

  const sendAnswer = () => {
    const q = profile.story.followUp?.question ?? "";
    run(`${text.trim()}\n\nQuestion: ${q}\nMy answer: ${answer.trim()}`);
  };

  const g = profile.goal;
  const p = profile.person;
  const s = profile.story;
  const hasStory = !!last;
  const busy = phase === "reading";
  let n = 0;
  const vis = () => shown > n++; // each row asks for the next slot in the reveal

  const stepNo = busy ? 2 : phase === "review" ? 3 : 1;
  const money = g.salaryFloor?.amount ? `${g.salaryFloor.currency} ${g.salaryFloor.amount.toLocaleString()} a ${g.salaryFloor.period}` : "";

  return (
    <div>
      <ScreenHeader step={1} title="Tell your story" line="Talk it through the way you would tell a friend. I turn the ramble into your Pivot Profile, which every other screen uses." />

      <ol className="mb-5 flex gap-2 text-xs text-muted" aria-label="Progress on this screen">
        {["Talk", "I sort it out", "Check what I understood"].map((l, i) => (
          <li key={l} className={`flex-1 rounded-lg border px-3 py-2 ${i + 1 === stepNo ? "border-accent bg-accent-soft text-text" : "border-border"}`}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-5">
        <Card title="Your story">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Click here and talk with Wispr Flow."
            aria-label="Your story. Click here and talk with Wispr Flow."
            className="w-full resize-y rounded-lg border border-border bg-bg p-4 text-base leading-relaxed outline-none focus:border-accent"
            disabled={busy}
          />
          <p className="mt-2 text-sm text-muted">
            Hold <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Fn</kbd> on a Mac or{" "}
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Ctrl + Win</kbd> on Windows, talk, then let go. Different key? Check Keybind shortcuts in Wispr Flow settings.
          </p>
          <p className="mt-1 text-sm text-muted">
            Say it however it comes out. Change your mind, wander off, come back. I sort it out. Using Wispr Pro? There is an <Link href="/wispr" className="text-accent underline underline-offset-2">optional transform</Link>.
          </p>
          {text && <div className="mt-2"><TransformBadge text={text} /></div>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Good to mention:</span>
            {GOOD_TO_MENTION.map((x) => (
              <Chip key={x}>{x}</Chip>
            ))}
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-sm" role="alert">
              <p className="text-bad">{error}</p>
              <p className="mt-1 text-muted">The free AI service may be busy or out of requests for today. Try again, or open a preloaded example.</p>
              <button className={`${secondaryBtn} mt-2`} onClick={() => replace(structuredClone(teacher))}>
                Open the preloaded teacher-to-UX example
              </button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={() => run(text)} disabled={busy || text.trim().length < 40}>
              {busy ? "Sorting out your story..." : "Turn my story into my Pivot Profile"}
            </button>
            {text.trim().length < 40 && <span className="text-xs text-muted">A few sentences is enough to start.</span>}
          </div>
        </Card>

        {busy && (
          <Card title="Sorting out your story" hint="Next you will see what I understood, side by side with what you said.">
            <div className="space-y-2" aria-busy="true">
              {[70, 90, 55, 80].map((w, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
              ))}
            </div>
          </Card>
        )}

        {hasStory && !busy && (
          <Card title="You said, we understood" hint="Left is your words. Right is what went into your Pivot Profile. Anything I could not hear says Not said yet, and I do not guess it.">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="min-w-0 rounded-lg border border-border bg-bg p-3" aria-label="What you said">
                <h3 className="text-sm font-semibold">What you said</h3>
                <p className="mt-2 max-h-[34rem] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{last}</p>
              </section>

              <section className="min-w-0 rounded-lg border border-border p-3" aria-label="What we understood">
                <h3 className="text-sm font-semibold">What we understood</h3>
                <dl className="mt-1 divide-y divide-border">
                  <Row label="Name" show={vis()} missing={!p.name}>{p.name}</Row>
                  <Row label="Lives in" show={vis()} missing={!p.location}>{p.location}</Row>
                  <Row label="Works as" show={vis()} missing={!p.currentRole}>
                    {[p.currentRole, p.currentIndustry && `in ${p.currentIndustry}`].filter(Boolean).join(" ")}
                    {p.yearsExperience > 0 && <span className="text-muted"> ({p.yearsExperience} years)</span>}
                  </Row>
                  <Row label="Wants to be" show={vis()} missing={!g.targetRole}>
                    {g.targetRole}
                    {g.alternateRoles.length > 0 && <div className="mt-1">{chips(g.alternateRoles)}</div>}
                  </Row>
                  <Row label="Deadline" show={vis()} missing={!g.deadline && !g.timelineWeeks}>
                    {g.deadline ? new Date(g.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}
                    {g.timelineWeeks > 0 && <span className="text-muted"> ({g.timelineWeeks} weeks)</span>}
                  </Row>
                  <Row label="Hours a week" show={vis()} missing={!g.hoursPerWeek}>{g.hoursPerWeek}</Row>
                  <Row label="Pay floor" show={vis()} missing={!money}>{money}</Row>
                </dl>

                <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Work history</h4>
                <dl className="divide-y divide-border">
                  {profile.experience.slice(0, 3).map((e) => (
                    <Row key={e.id} label={e.period || "Role"} show={vis()}>
                      <span className="font-medium">{[e.role, e.org].filter(Boolean).join(", ")}</span>
                      {e.achievements.length > 0 && <ul className="mt-1 list-disc pl-4 text-muted">{e.achievements.slice(0, 3).map((a) => <li key={a}>{a}</li>)}</ul>}
                      {e.toolsUsed.length > 0 && <div className="mt-1.5">{chips(e.toolsUsed)}</div>}
                    </Row>
                  ))}
                  {profile.experience.length === 0 && <Row label="Roles" show={vis()} missing />}
                </dl>
              </section>
            </div>

            {(s.corrections.length > 0 || s.preferences.length > 0) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <section className="min-w-0 rounded-lg border border-border p-3" aria-label="Changes of mind we resolved">
                  <h3 className="text-sm font-semibold">Changes of mind we resolved</h3>
                  <p className="mt-0.5 text-xs text-muted">You corrected yourself. Only the last version is kept.</p>
                  {s.corrections.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">None this time.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border">
                      {s.corrections.slice(0, 6).map((c) => (
                        <li key={c.topic + c.was} className={`py-2 text-sm ${vis() ? "pop-in" : "invisible"}`}>
                          <span className="text-muted">{c.topic}: </span>
                          <span className="text-muted line-through">{c.was}</span> <span aria-hidden>&rarr;</span> <span className="font-medium">{c.now}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="min-w-0 rounded-lg border border-border p-3" aria-label="Kept as preferences">
                  <h3 className="text-sm font-semibold">Side comments kept as preferences</h3>
                  <p className="mt-0.5 text-xs text-muted">Your plan and projects will respect these.</p>
                  {s.preferences.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">None this time.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border">
                      {s.preferences.slice(0, 6).map((x) => (
                        <li key={x.text} className={`flex gap-2 py-2 text-sm ${vis() ? "pop-in" : "invisible"}`}>
                          <span className="shrink-0 self-start rounded-full bg-accent-soft px-2 py-0.5 text-xs">{KIND[x.kind]}</span>
                          <span>{x.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </Card>
        )}

        {hasStory && !busy && (s.followUp || s.roleSuggestions.length > 0) && (
          <Card
            title={s.roleSuggestions.length ? "Not sure of the role yet? Here are a few that fit you" : "One quick question"}
            hint={s.followUp?.question || "Pick one to continue. You can change it later."}
          >
            {s.roleSuggestions.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-3">
                {s.roleSuggestions.slice(0, 3).map((r, i) => (
                  <li key={r.title} className="flex flex-col rounded-lg border border-border p-3">
                    <span className="text-xs text-muted">
                      {i + 1}. {DISTANCE[r.distance]}
                    </span>
                    <span className="mt-1 text-sm font-medium">{r.title}</span>
                    <span className="mt-1 flex-1 text-sm text-muted">{r.why}</span>
                    <button className={`${secondaryBtn} mt-3`} onClick={() => update((x) => chooseRole(x, r.title))}>
                      Aim for this role
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 block text-sm text-muted" htmlFor="followup">
              {s.roleSuggestions.length ? "Or tell me in your own words:" : "Your answer (speak it with Wispr Flow):"}
            </label>
            <textarea
              id="followup"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
            />
            <button className={`${primaryBtn} mt-3`} onClick={sendAnswer} disabled={answer.trim().length < 2}>
              Add my answer and update my profile
            </button>
          </Card>
        )}

        {hasStory && !busy && (
          <div className="flex flex-wrap items-center gap-3">
            {g.targetRole ? (
              <>
                <Link href="/skills" className={`${primaryBtn} inline-block`}>
                  Looks right: open my Skill bridge
                </Link>
                <span className="text-sm text-muted">Next: see the gap between your skills and {g.targetRole}.</span>
              </>
            ) : (
              <>
                <button className={primaryBtn} disabled>
                  Looks right: open my Skill bridge
                </button>
                <span className="text-sm text-muted">Pick a target role above to continue.</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
