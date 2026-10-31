"use client";

import Link from "next/link";
import { useState } from "react";
import { RubricTable, ScorePips, TurnFeedback } from "@/components/interview-bits";
import { Card, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { callAgent } from "@/lib/client/agentClient";
import {
  TOTAL_QUESTIONS, activeSession, applyTurn, dimensionAverages, interviewInput, planNext, rubricInput, rubricStale, shapeRubric, startSession, stripTransformTags,
} from "@/lib/interview";
import { useProfile } from "@/lib/profile-context";
import type { InterviewTurnResult, RubricResult } from "@/lib/schemas/agents";

const KIND = { switch: "Opening question", followup: "Follow-up on your answer", role: "Question for the role" } as const;

export default function InterviewPage() {
  const { profile, replace } = useProfile();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"" | "rubric" | "score">("");
  const [error, setError] = useState("");

  const role = profile.goal.targetRole;
  const rubric = profile.rubric;
  const active = activeSession(profile);
  const last = profile.interviews[profile.interviews.length - 1];
  const stale = rubricStale(profile);
  const lastTurn = last?.turns[last.turns.length - 1];
  const answered = active?.turns.length ?? 0;

  const writeRubric = async () => {
    setError("");
    setBusy("rubric");
    try {
      const r = await callAgent<RubricResult>("rubric", rubricInput(profile), { fresh: !!rubric });
      replace({ ...profile, rubric: shapeRubric(profile, r, new Date().toISOString()) });
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy("");
  };

  const start = () => {
    setError("");
    replace(startSession(profile, new Date().toISOString()));
  };

  const submit = async () => {
    if (!active || !rubric) return;
    setError("");
    setBusy("score");
    try {
      const cleaned = stripTransformTags(answer); // interview answers are judged as plain content
      const next = planNext(active, rubric);
      const r = await callAgent<InterviewTurnResult>("interview", interviewInput(profile, active, cleaned, next), { fresh: true });
      replace(applyTurn(profile, active.id, r, cleaned, next, new Date().toISOString()));
      setAnswer("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setBusy("");
  };

  const finished = last?.finishedAt ? last : undefined;
  const summary = finished ? dimensionAverages(finished, rubric!) : [];
  const lowered = finished ? finished.turns.flatMap((t) => t.skillChanges) : [];
  const tagsInAnswer = stripTransformTags(answer) !== answer.trim();

  return (
    <div>
      <ScreenHeader
        step={5}
        title="Mock interviews"
        line={`${TOTAL_QUESTIONS} questions for ${role || "your target role"}, asked one at a time. Answer out loud with Wispr Flow. I score what you say against a rubric written for this role.`}
      />

      <div className="flex flex-col gap-5">
        {!role ? (
          <Card title="Your interview" hint="The rubric is written for your target role, so I need to know it first.">
            <Link href="/intake" className={`${primaryBtn} inline-block`}>
              Tell me your target role
            </Link>
          </Card>
        ) : (
          <>
            <Card
              title={rubric ? `How you will be scored: ${rubric.role}` : "Your scoring rubric"}
              hint={
                rubric
                  ? "Four dimensions written for this role, each scored 1 to 4. Nothing here is a fixed template."
                  : `I write four scoring dimensions for ${role} from its job descriptions (${profile.targetRole.jds.length} analysed), so you know what a strong answer sounds like before you start.`
              }
            >
              {rubric ? (
                <details open={!active && !finished}>
                  <summary className="mb-3 cursor-pointer text-sm text-muted">
                    {rubric.dimensions.map((d) => d.name).join(", ")}
                  </summary>
                  <RubricTable rubric={rubric} skills={profile.skills} />
                </details>
              ) : null}
              {stale && (
                <p className="mt-3 rounded-lg bg-surface-2 p-2 text-sm text-muted">Your target role or its job descriptions changed since this rubric was written.</p>
              )}
              {error && !active && (
                <p className="mt-3 text-sm text-bad" role="alert">
                  {error}
                </p>
              )}
              {(!rubric || stale) && (
                <button className={`${rubric ? secondaryBtn : primaryBtn} mt-3`} onClick={writeRubric} disabled={busy !== ""}>
                  {busy === "rubric" ? "Writing your rubric..." : rubric ? "Rewrite the rubric for the new role" : `Write my rubric for ${role}`}
                </button>
              )}
              {busy === "rubric" && <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface-2" aria-busy="true" />}
            </Card>

            {rubric && lastTurn && last && (
              <Card title="Feedback on your last answer" hint={`You were asked: ${lastTurn.question}`}>
                <TurnFeedback turn={lastTurn} rubric={rubric} skills={profile.skills} />
              </Card>
            )}

            {rubric && finished && (
              <Card title="Your results" hint={`Average score per dimension across ${finished.turns.length} answers. A dimension with no bar was not tested this time.`}>
                <ul className="flex flex-col gap-3">
                  {summary.map((s) => (
                    <li key={s.dimension.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{s.dimension.name}</span>
                        {s.n > 0 ? <ScorePips score={Math.round(s.avg)} label={`${s.dimension.name}: average ${s.avg.toFixed(1)} of 4`} /> : <span className="text-xs text-muted">Not tested</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  {lowered.length
                    ? `${lowered.length} skill${lowered.length > 1 ? "s were" : " was"} lowered because of weak, quoted answers.`
                    : "No skill was lowered: none of your weak answers was backed by a quote, or you had none."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href="/skills" className={`${secondaryBtn} inline-block`}>
                    See my updated skills
                  </Link>
                  <Link href="/checkin" className={`${primaryBtn} inline-block`}>
                    Do my weekly check-in
                  </Link>
                </div>
              </Card>
            )}

            {rubric && !active && (
              <Card
                title={finished ? "Interview finished" : "Start your mock interview"}
                hint={
                  finished
                    ? "Your results are above. Run another one whenever you like: the questions will be different."
                    : `${TOTAL_QUESTIONS} questions: why you are switching careers, one follow-up on your answer, then ${TOTAL_QUESTIONS - 2} questions for the role. About 10 minutes.`
                }
              >
                <button className={primaryBtn} onClick={start} disabled={busy !== ""}>
                  {finished ? "Start another interview" : "Start the interview"}
                </button>
              </Card>
            )}

            {rubric && active?.pending && (
              <Card title={`Question ${answered + 1} of ${TOTAL_QUESTIONS}`} hint={KIND[active.pending.kind]}>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={TOTAL_QUESTIONS}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${(answered / TOTAL_QUESTIONS) * 100}%` }} />
                </div>
                <p className="mt-4 text-lg font-medium leading-snug">{active.pending.question}</p>
                {active.pending.dimensionId && (
                  <p className="mt-1 text-xs text-muted">Tests: {rubric.dimensions.find((d) => d.id === active.pending!.dimensionId)?.name}</p>
                )}
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={7}
                  placeholder="Click here and answer out loud with Wispr Flow."
                  aria-label="Your answer. Click here and answer out loud with Wispr Flow."
                  className="mt-4 w-full resize-y rounded-lg border border-border bg-bg p-4 text-base leading-relaxed outline-none focus:border-accent"
                  disabled={busy !== ""}
                />
                <p className="mt-2 text-sm text-muted">
                  Hold <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Fn</kbd> on a Mac or{" "}
                  <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">Ctrl + Win</kbd> on Windows, talk, then let go. I judge what you say, not how it is written, so fillers and typos cost nothing.
                </p>
                {tagsInAnswer && <p className="mt-1 text-xs text-muted">Labels added by the Pivotin&apos; transform are ignored for interview answers.</p>}
                {error && (
                  <p className="mt-3 text-sm text-bad" role="alert">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className={primaryBtn} onClick={submit} disabled={busy !== "" || stripTransformTags(answer).length < 15}>
                    {busy === "score" ? "Scoring your answer..." : answered + 1 >= TOTAL_QUESTIONS ? "Score my answer and finish" : "Score my answer and ask the next question"}
                  </button>
                  {stripTransformTags(answer).length < 15 && <span className="text-xs text-muted">Say a few sentences first.</span>}
                </div>
                {busy === "score" && (
                  <div className="mt-4 space-y-2" aria-busy="true">
                    {[80, 60, 70].map((w, i) => (
                      <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {rubric && profile.interviews.length > 0 && (active?.turns.length ?? 0) > 1 && (
              <Card title="Earlier answers in this interview">
                <ol className="divide-y divide-border">
                  {active!.turns.slice(0, -1).map((t, i) => (
                    <li key={i} className="py-3">
                      <details>
                        <summary className="cursor-pointer text-sm">
                          <span className="font-medium">{i + 1}.</span> {t.question}
                          <span className="ml-2 text-xs text-muted">{t.scores.map((s) => `${s.score}/4`).join(", ")}</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{t.answer}</p>
                        <div className="mt-2">
                          <TurnFeedback turn={t} rubric={rubric} skills={profile.skills} />
                        </div>
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
