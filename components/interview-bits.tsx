"use client";

import type { Rubric, Session } from "@/lib/interview";
import type { Skill } from "@/lib/types";

type Turn = Session["turns"][number];

const TONE = ["", "bg-bad", "bg-warn", "bg-accent", "bg-good"]; // score 1..4

// Four pips, filled up to the score.
export function ScorePips({ score, label }: { score: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label ?? `Score ${score} of 4`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-2 w-5 rounded-sm ${n <= score ? TONE[score] : "bg-surface-2"}`} />
        ))}
      </span>
      <span className="text-sm font-medium">{score} of 4</span>
    </span>
  );
}

// What the rubric says a score of 1 to 4 sounds like, per dimension.
export function RubricTable({ rubric, skills }: { rubric: Rubric; skills: Skill[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rubric.dimensions.map((d) => (
        <section key={d.id} className="rounded-lg border border-border p-3" aria-label={d.name}>
          <h3 className="text-sm font-semibold">{d.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{d.what}</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {d.levels.map((l, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-xs ${i === 0 ? "text-accent-text" : "text-accent-text"} ${TONE[i + 1]}`}>{i + 1}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
          {d.skillIds.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Evidence for: {d.skillIds.map((id) => skills.find((s) => s.id === id)?.label ?? id).join(", ")}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

// The result for one answer: score and its meaning, a word-for-word quote, one thing to improve, any skill change.
export function TurnFeedback({ turn, rubric, skills }: { turn: Turn; rubric: Rubric; skills: Skill[] }) {
  return (
    <div className="flex flex-col gap-3">
      {turn.scores.map((s) => {
        const d = rubric.dimensions.find((x) => x.id === s.dimensionId);
        return (
          <section key={s.dimensionId} className="rounded-lg border border-border bg-bg p-3" aria-label={d?.name}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{d?.name ?? s.dimensionId}</h3>
              <ScorePips score={s.score} label={`${d?.name}: ${s.score} of 4`} />
            </div>
            {d && <p className="mt-1 text-xs text-muted">A {s.score} means: {d.levels[s.score - 1]}</p>}
            <blockquote className="mt-2 border-l-2 border-accent pl-3 text-sm italic">
              &ldquo;{s.quote || "No quote"}&rdquo;
              <footer className="mt-0.5 text-xs not-italic text-muted">
                {s.verified ? "Word for word from your answer" : "Not an exact quote from your answer, so this score cannot change your skills"}
              </footer>
            </blockquote>
            <p className="mt-2 text-sm">{s.why}</p>
          </section>
        );
      })}
      {turn.improve && (
        <p className="rounded-lg bg-accent-soft p-3 text-sm">
          <span className="font-medium">One thing to improve: </span>
          {turn.improve}
        </p>
      )}
      {turn.skillChanges.map((c) => {
        const sk = skills.find((s) => s.id === c.skillId);
        return (
          <p key={c.skillId} className="rounded-lg border border-bad p-3 text-sm" role="status">
            <span className="font-medium">Skill level lowered: </span>
            {sk?.label ?? c.skillId} went from {c.from} to {c.to} of 3, because of a weak score backed by your own words. Answer well next time and it stays; the Skill bridge shows the new level.
          </p>
        );
      })}
    </div>
  );
}
