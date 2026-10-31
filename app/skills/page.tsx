"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { applyBridge, bridgeInput, mergeJd } from "@/lib/bridge";
import { callAgent } from "@/lib/client/agentClient";
import { useProfile } from "@/lib/profile-context";
import { BridgeResult, JdResult } from "@/lib/schemas/jd";
import { readiness, Skill } from "@/lib/types";

type Phase = "idle" | "jd" | "bridge";

const GROUPS: { status: Skill["status"]; title: string; hint: string; color: string }[] = [
  { status: "gap", title: "Gaps to close", hint: "Little or no evidence yet. These need the most work.", color: "bg-bad" },
  { status: "transferable", title: "Transferable", hint: "You have a base from your current work. Build on it.", color: "bg-warn" },
  { status: "have", title: "Already strong", hint: "You meet the bar for these today.", color: "bg-good" },
];
const LIMIT = 7;

function SkillRow({ s, color, isNew }: { s: Skill; color: string; isNew: boolean }) {
  return (
    <li className="py-3">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {s.label}
              {isNew && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-normal">New from this job description</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">
              You {s.current}/3, needs {s.required}
            </span>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-surface-2" role="img" aria-label={`${s.label}: level ${s.current} of 3, the role needs ${s.required}`}>
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(Math.min(s.current, 3) / 3) * 100}%` }} />
            <div className="absolute top-[-3px] h-3.5 w-0.5 bg-text" style={{ left: `${(Math.min(s.required, 3) / 3) * 100}%` }} title="What the role needs" />
          </div>
        </summary>
        <div className="mt-2 text-sm text-muted">
          {s.evidence.length ? (
            <ul className="list-disc pl-5">{s.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
          ) : (
            <p>No evidence from your background yet. The plan will add practice for this.</p>
          )}
        </div>
      </details>
    </li>
  );
}

export default function SkillsPage() {
  const { profile, replace } = useProfile();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [newIds, setNewIds] = useState<string[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const busy = phase !== "idle";
  const hasSkills = profile.skills.length > 0;
  const hasReqs = profile.targetRole.requirements.length > 0;

  const rate = async (p: typeof profile) => {
    setPhase("bridge");
    const r = await callAgent<BridgeResult>("bridge", bridgeInput(p));
    replace(applyBridge(p, r));
  };

  const addJd = async () => {
    setError("");
    setNewIds([]);
    try {
      setPhase("jd");
      const jd = await callAgent<JdResult>("jd", {
        text,
        roleHint: profile.goal.targetRole,
        existing: profile.targetRole.requirements.map((r) => r.label),
      });
      const { profile: merged, newSkillIds } = mergeJd(profile, jd, text || `Role only: ${profile.goal.targetRole}`);
      replace(merged);
      await rate(merged);
      setNewIds(newSkillIds);
      setText("");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setPhase("idle");
  };

  const rerate = async () => {
    setError("");
    try {
      await rate(profile);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setPhase("idle");
  };

  const pct = readiness(profile);
  const gaps = [...profile.skills].filter((s) => s.status === "gap").sort((a, b) => b.required - b.current - (a.required - a.current));
  const jds = profile.targetRole.jds;

  return (
    <div>
      <ScreenHeader
        step={2}
        title="Skill bridge"
        line={`Paste a job description for ${profile.goal.targetRole || "your target role"}. I compare what it asks for with what you already have.`}
      />

      <div className="flex flex-col gap-5">
        <Card
          title="Job descriptions"
          hint={
            jds.length
              ? `${jds.length} analysed. Add one more and the map updates. Skills asked for in more of them count for more.`
              : "Paste one job description to start. No JD yet? Build the map from your target role name."
          }
        >
          {jds.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {jds.slice(0, 6).map((j) => (
                <Chip key={j.id}>{[j.company, j.title].filter(Boolean).join(" - ") || "Job description"}</Chip>
              ))}
              {jds.length > 6 && <Chip>+{jds.length - 6} more</Chip>}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste the full job description here..."
            className="w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
            disabled={busy}
          />
          {error && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={addJd} disabled={busy || text.trim().length < 60}>
              {busy ? (phase === "jd" ? "Reading the job description..." : "Comparing with your background...") : "Add this job description and update my skill map"}
            </button>
            {!text.trim() && !hasReqs && profile.goal.targetRole && (
              <button className={secondaryBtn} onClick={addJd} disabled={busy}>
                Build from "{profile.goal.targetRole}" only
              </button>
            )}
            {hasReqs && (
              <button className={secondaryBtn} onClick={rerate} disabled={busy}>
                Re-rate my skills
              </button>
            )}
          </div>
          {busy && (
            <ol className="mt-3 flex gap-2 text-xs text-muted" aria-live="polite">
              <li className={`flex-1 rounded-lg border px-3 py-2 ${phase === "jd" ? "border-accent bg-accent-soft text-text" : "border-border"}`}>1. Read the job description</li>
              <li className={`flex-1 rounded-lg border px-3 py-2 ${phase === "bridge" ? "border-accent bg-accent-soft text-text" : "border-border"}`}>2. Compare with your background</li>
            </ol>
          )}
        </Card>

        {hasSkills ? (
          <>
            <Card title="Where you stand" hint="Readiness is how much of the role's skill bar you already meet.">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-semibold">{pct}%</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {gaps.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted">Biggest gaps:</span>
                  {gaps.slice(0, 3).map((g) => (
                    <Chip key={g.id}>{g.label}</Chip>
                  ))}
                </div>
              )}
            </Card>

            {GROUPS.map((g) => {
              const items = profile.skills
                .filter((s) => s.status === g.status)
                .sort((a, b) => b.required - b.current - (a.required - a.current));
              if (!items.length) return null;
              const all = open[g.status];
              return (
                <Card key={g.status} title={`${g.title} (${items.length})`} hint={g.hint}>
                  <ul className="divide-y divide-border">
                    {(all ? items : items.slice(0, LIMIT)).map((s) => (
                      <SkillRow key={s.id} s={s} color={g.color} isNew={newIds.includes(s.id)} />
                    ))}
                  </ul>
                  {items.length > LIMIT && (
                    <button className="mt-2 text-sm text-accent" onClick={() => setOpen((o) => ({ ...o, [g.status]: !all }))}>
                      {all ? "Show fewer" : `Show all ${items.length}`}
                    </button>
                  )}
                </Card>
              );
            })}

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/plan" className={`${primaryBtn} inline-block`}>
                Build my weekly plan from these gaps
              </Link>
              <span className="text-sm text-muted">Next: a week-by-week plan that fits your hours.</span>
            </div>
          </>
        ) : (
          <Card title="Your skill map" hint="It appears here once you add a job description above.">
            <p className="text-sm text-muted">
              {profile.experience.length ? "Your background is saved. Add a job description to see the gap." : "Tell your story first (step 1), then come back here."}
            </p>
            {!profile.experience.length && (
              <Link href="/intake" className={`${secondaryBtn} mt-3 inline-block`}>
                Go to Tell your story
              </Link>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
