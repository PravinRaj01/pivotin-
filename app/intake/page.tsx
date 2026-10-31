"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import { useProfile } from "@/lib/profile-context";
import { IntakeResult } from "@/lib/schemas/intake";
import { teacher } from "@/lib/seeds/teacher";

const PROMPTS = [
  "Who you are and what you do now",
  "Where you want to go, and by when",
  "How many hours a week you can give",
  "What worries you about the switch",
];

type Phase = "write" | "reading" | "review";

// Rows reveal one by one once the response arrives (no streaming; cheap but feels alive).
function Row({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="pop-in grid gap-1 py-2 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm">{children || <span className="text-muted">Not mentioned</span>}</dd>
    </div>
  );
}

const chips = (xs: string[]) => (xs.length ? <span className="flex flex-wrap gap-1.5">{xs.slice(0, 6).map((x) => <Chip key={x}>{x}</Chip>)}</span> : null);

export default function IntakePage() {
  const { profile, update, replace, ready } = useProfile();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("write");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready) setText(profile.story.rawTranscripts.at(-1)?.text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile.id]);

  const total = 16;
  useEffect(() => {
    if (phase !== "review" || shown >= total) return;
    const t = setTimeout(() => setShown((n) => n + 1), 220);
    return () => clearTimeout(t);
  }, [phase, shown]);

  const run = async () => {
    setError("");
    setPhase("reading");
    try {
      const r = await callAgent<IntakeResult>("intake", { transcript: text });
      setResult(r);
      setShown(0);
      setPhase("review");
      update((p) => ({
        ...p,
        person: { ...p.person, ...r.person, education: r.person.education || p.person.education },
        goal: { ...p.goal, ...r.goal, targetIndustry: r.goal.targetIndustry || p.goal.targetIndustry },
        story: {
          ...p.story,
          rawTranscripts: p.story.rawTranscripts.some((t) => t.text === text)
            ? p.story.rawTranscripts
            : [...p.story.rawTranscripts, { id: crypto.randomUUID(), at: new Date().toISOString(), text }],
          summary: r.summary,
          strengths: r.strengths,
          fears: r.fears,
        },
        experience: r.experience.length ? r.experience.map((e) => ({ ...e, id: crypto.randomUUID() })) : p.experience,
      }));
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setPhase("write");
    }
  };

  const stepNo = phase === "write" ? 1 : phase === "reading" ? 2 : 3;
  const s = (n: number) => shown >= n;

  return (
    <div>
      <ScreenHeader step={1} title="Tell your story" line="Speak or type it the way you would tell a friend. I turn it into your Pivot Profile that every other screen uses." />

      <ol className="mb-5 flex gap-2 text-xs text-muted" aria-label="Progress on this screen">
        {["Tell it", "I read it", "Check what I heard"].map((l, i) => (
          <li key={l} className={`flex-1 rounded-lg border px-3 py-2 ${i + 1 === stepNo ? "border-accent bg-accent-soft text-text" : "border-border"}`}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-5">
        <Card title="Your story" hint="Start Wispr Flow, click the box and just talk for a minute or two. Then press the button below.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Hi, I'm... I currently work as... I want to move into..."
            className="w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
            disabled={phase === "reading"}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-muted">Try to cover:</span>
            {PROMPTS.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-sm" role="alert">
              <p className="text-bad">{error}</p>
              <p className="mt-1 text-muted">The free AI service may be busy. Try again in a moment, or open a preloaded example.</p>
              <button className={`${secondaryBtn} mt-2`} onClick={() => replace(structuredClone(teacher))}>
                Open the preloaded teacher-to-UX example
              </button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={run} disabled={phase === "reading" || text.trim().length < 40}>
              {phase === "reading" ? "Reading your story..." : "Turn my story into my Pivot Profile"}
            </button>
            {text.trim().length < 40 && <span className="text-xs text-muted">A few sentences is enough to start.</span>}
          </div>
        </Card>

        {phase === "reading" && (
          <Card title="Reading your story" hint="This takes a few seconds. Next you will see what I heard, so you can correct me.">
            <div className="space-y-2" aria-busy="true">
              {[70, 90, 55, 80].map((w, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
              ))}
            </div>
          </Card>
        )}

        {phase === "review" && result && (
          <>
            <Card title="About you" hint="Saved to your Pivot Profile. Edit your story above and run it again if anything is wrong.">
              <dl className="divide-y divide-border">
                <Row label="Name" show={s(1)}>{result.person.name}</Row>
                <Row label="Based in" show={s(2)}>{result.person.location}</Row>
                <Row label="Today" show={s(3)}>
                  {[result.person.currentRole, result.person.currentIndustry && `in ${result.person.currentIndustry}`].filter(Boolean).join(" ")}
                </Row>
                <Row label="Experience" show={s(4)}>{result.person.yearsExperience ? `${result.person.yearsExperience} years` : ""}</Row>
              </dl>
            </Card>

            <Card title="Your goal">
              <dl className="divide-y divide-border">
                <Row label="Target role" show={s(5)}>{[result.goal.targetRole, result.goal.targetIndustry && `(${result.goal.targetIndustry})`].filter(Boolean).join(" ")}</Row>
                <Row label="Time" show={s(6)}>{`${result.goal.timelineWeeks} weeks, ${result.goal.hoursPerWeek} hours a week`}</Row>
                <Row label="Why" show={s(7)}>{result.goal.motivation}</Row>
                <Row label="Limits" show={s(8)}>{chips(result.goal.constraints)}</Row>
              </dl>
            </Card>

            <Card title="Your background">
              <dl className="divide-y divide-border">
                {result.experience.slice(0, 3).map((e, i) => (
                  <Row key={i} label={e.period || "Role"} show={s(9 + i)}>
                    <span className="font-medium">{[e.role, e.org].filter(Boolean).join(", ")}</span>
                    {e.achievements.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-muted">{e.achievements.slice(0, 3).map((a) => <li key={a}>{a}</li>)}</ul>
                    )}
                    {e.toolsUsed.length > 0 && <div className="mt-1.5">{chips(e.toolsUsed)}</div>}
                  </Row>
                ))}
                {result.experience.length === 0 && <Row label="Roles" show={s(9)}>{null}</Row>}
                <Row label="Strengths" show={s(12)}>{chips(result.strengths)}</Row>
                <Row label="Worries" show={s(13)}>{chips(result.fears)}</Row>
              </dl>
            </Card>

            {result.missing.length > 0 && (
              <Card title="Still unclear" hint="Add a sentence about any of these to your story and run it again for a sharper plan.">
                <ul className={`list-disc pl-5 text-sm ${s(14) ? "pop-in" : "invisible"}`}>
                  {result.missing.slice(0, 5).map((m) => <li key={m}>{m}</li>)}
                </ul>
              </Card>
            )}

            <div className={`flex flex-wrap items-center gap-3 ${s(15) ? "pop-in" : "invisible"}`}>
              <Link href="/skills" className={`${primaryBtn} inline-block`}>
                Looks right: open my Skill bridge
              </Link>
              <span className="text-sm text-muted">Next: see the gap between your skills and the role.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
