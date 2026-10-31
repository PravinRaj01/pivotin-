"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { applyBridge, bandOf, bridgeInput, mergeJd, type Band } from "@/lib/bridge";
import { callAgent } from "@/lib/client/agentClient";
import { useProfile } from "@/lib/profile-context";
import { BridgeResult, JdResult } from "@/lib/schemas/jd";
import type { Skill } from "@/lib/types";

type Phase = "idle" | "jd" | "bridge";
type Column = Skill["status"];

const COLUMNS: { id: Column; title: string; hint: string; dot: string }[] = [
  { id: "have", title: "Have", hint: "You already do this, under the same name.", dot: "bg-good" },
  { id: "transferable", title: "Transferable", hint: "You have done it under another name.", dot: "bg-warn" },
  { id: "missing", title: "Missing", hint: "No evidence yet. The plan will cover these.", dot: "bg-bad" },
];
const BAND_LABEL: Record<Band, string> = { "must-have": "Must-have", common: "Common", rare: "Rare" };
const BAND_ORDER: Record<Band, number> = { "must-have": 0, common: 1, rare: 2 };
const SHOW = 7; // most cards shown in a column before "show more"

function Level({ current, required }: { current: number; required: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Your level ${current} of 3. The role asks for ${required}.`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-2 w-4 rounded-sm ${n <= current ? "bg-accent" : n <= required ? "border border-accent" : "bg-surface-2"}`} />
        ))}
      </span>
      Level {current} of 3, role asks {required}
    </span>
  );
}

function SkillCard({ s, share, count, total, isNew }: { s: Skill; share: number; count: number; total: number; isNew: boolean }) {
  const band = bandOf(share);
  return (
    <li className="rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium">{s.label}</span>
        {isNew && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">New</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className={`rounded-full px-2 py-0.5 ${band === "must-have" ? "bg-accent-soft text-text" : "bg-surface-2"}`}>{BAND_LABEL[band]}</span>
        <span>
          Asked for in {count} of {total} job descriptions ({Math.round(share * 100)}%)
        </span>
      </div>
      <div className="mt-2">
        <Level current={s.current} required={s.required} />
      </div>

      {s.status === "transferable" && (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 text-xs" aria-label="Your wording and the role's wording">
          <div className="rounded-md bg-surface-2 p-2">
            <p className="text-muted">You wrote</p>
            <p className="mt-0.5 text-sm">{s.oldWording || "Your own words"}</p>
          </div>
          <span className="self-center text-muted" aria-hidden>
            &rarr;
          </span>
          <div className="rounded-md bg-accent-soft p-2">
            <p className="text-muted">The role says</p>
            <p className="mt-0.5 text-sm">{s.targetWording || s.label}</p>
          </div>
        </div>
      )}
      {s.status === "missing" && s.targetWording && (
        <p className="mt-3 text-xs text-muted">
          The role says: <span className="text-text">{s.targetWording}</span>
        </p>
      )}

      {s.evidence[0] && (
        <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm italic">
          &ldquo;{s.evidence[0]}&rdquo;
          <footer className="mt-0.5 text-xs not-italic text-muted">
            {s.evidenceVerified === false ? "Not an exact quote from your text, treat it as a summary" : "Word for word from your story or resume"}
          </footer>
        </blockquote>
      )}
    </li>
  );
}

export default function SkillsPage() {
  const { profile, replace } = useProfile();
  const [text, setText] = useState("");
  const [resume, setResume] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [newIds, setNewIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Column>("have");
  const [showRare, setShowRare] = useState(false);
  const [more, setMore] = useState<Record<string, boolean>>({});

  const busy = phase !== "idle";
  const reqs = profile.targetRole.requirements;
  const total = profile.targetRole.jds.length;
  const hasSkills = profile.skills.length > 0;
  const reqOf = (id: string) => reqs.find((r) => r.skillId === id);
  const role = profile.goal.targetRole || "your target role";

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
      const jd = await callAgent<JdResult>("jd", { text, roleHint: profile.goal.targetRole, existing: reqs.map((r) => r.label) });
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

  const resort = async () => {
    setError("");
    try {
      const p = resume !== null && resume !== (profile.person.resume ?? "") ? { ...profile, person: { ...profile.person, resume } } : profile;
      if (p !== profile) replace(p);
      await rate(p);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    }
    setPhase("idle");
  };

  const byColumn = (col: Column) =>
    profile.skills
      .filter((s) => s.status === col && reqOf(s.id))
      // Rare skills are hidden to keep the map short, except transferable ones: those are the pivot story.
      .filter((s) => showRare || s.status === "transferable" || bandOf(reqOf(s.id)!.frequency) !== "rare")
      .sort((a, b) => {
        const ra = reqOf(a.id)!, rb = reqOf(b.id)!;
        return BAND_ORDER[bandOf(ra.frequency)] - BAND_ORDER[bandOf(rb.frequency)] || rb.frequency - ra.frequency || rb.importance - ra.importance;
      });

  const rareCount = profile.skills.filter((s) => reqOf(s.id) && s.status !== "transferable" && bandOf(reqOf(s.id)!.frequency) === "rare").length;
  const must = profile.skills.filter((s) => reqOf(s.id) && bandOf(reqOf(s.id)!.frequency) === "must-have");
  const mustCovered = must.filter((s) => s.status !== "missing").length;
  const counts = Object.fromEntries(COLUMNS.map((c) => [c.id, byColumn(c.id).length])) as Record<Column, number>;

  return (
    <div>
      <ScreenHeader
        step={2}
        title="Skill bridge"
        line={`Add a few real job descriptions for ${role}. I count which skills they ask for, then sort each one into Have, Transferable or Missing.`}
      />

      <div className="flex flex-col gap-5">
        <Card
          title="Job descriptions"
          hint={
            total
              ? `${total} analysed. Each one you add sharpens the counts below.`
              : "Paste a job description, or dictate it with Wispr Flow. Three or more gives a reliable count."
          }
        >
          {total > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {profile.targetRole.jds.slice(0, 6).map((j) => (
                <Chip key={j.id}>{[j.company, j.title].filter(Boolean).join(" - ") || "Job description"}</Chip>
              ))}
              {total > 6 && <Chip>+{total - 6} more</Chip>}
            </div>
          )}
          {total > 0 && total < 3 && (
            <p className="mb-3 rounded-lg bg-surface-2 p-2 text-sm text-muted">
              Only {total} job description{total > 1 ? "s" : ""} so far, so every count is a big share. Add {3 - total} more for a count you can trust.
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste or dictate a job description here..."
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
              {busy ? (phase === "jd" ? "Reading the job description..." : "Sorting your skills...") : "Add this job description and sort my skills"}
            </button>
            {!text.trim() && !reqs.length && profile.goal.targetRole && (
              <button className={secondaryBtn} onClick={addJd} disabled={busy}>
                Start from the role name &ldquo;{profile.goal.targetRole}&rdquo;
              </button>
            )}
            {reqs.length > 0 && (
              <button className={secondaryBtn} onClick={resort} disabled={busy}>
                Sort my skills again
              </button>
            )}
          </div>
          {busy && (
            <ol className="mt-3 flex gap-2 text-xs text-muted" aria-live="polite">
              <li className={`flex-1 rounded-lg border px-3 py-2 ${phase === "jd" ? "border-accent bg-accent-soft text-text" : "border-border"}`}>1. Read the job description</li>
              <li className={`flex-1 rounded-lg border px-3 py-2 ${phase === "bridge" ? "border-accent bg-accent-soft text-text" : "border-border"}`}>2. Compare with your background</li>
            </ol>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted">Your resume (optional): the more you paste, the better the quotes</summary>
            <textarea
              value={resume ?? profile.person.resume ?? ""}
              onChange={(e) => setResume(e.target.value)}
              rows={6}
              placeholder="Paste your resume. I only quote words that are really in it."
              className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
              disabled={busy}
            />
            <p className="mt-1 text-xs text-muted">Press &ldquo;Sort my skills again&rdquo; to use it.</p>
          </details>
        </Card>

        {hasSkills ? (
          <>
            <Card title="Where you stand" hint="A must-have is asked for in 60% or more of the job descriptions. Common is 30 to 59%. Rare is under 30%.">
              <p className="text-sm">
                Based on <strong>{total}</strong> job description{total === 1 ? "" : "s"}. You cover <strong>{mustCovered}</strong> of <strong>{must.length}</strong> must-have skills.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {COLUMNS.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-2">
                    <p className="text-xl font-semibold">{counts[c.id]}</p>
                    <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                      {c.title}
                    </p>
                  </div>
                ))}
              </div>
              {!showRare && rareCount > 0 && <p className="mt-2 text-xs text-muted">Counts leave out {rareCount} rare skills (asked for in under 30% of the job descriptions). Rare skills you have done under another name are always shown.</p>}
            </Card>

            <div className="flex gap-2 xl:hidden" role="tablist" aria-label="Skill columns">
              {COLUMNS.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={tab === c.id}
                  onClick={() => setTab(c.id)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-sm ${tab === c.id ? "border-accent bg-accent-soft font-medium" : "border-border text-muted"}`}
                >
                  {c.title} ({counts[c.id]})
                </button>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              {COLUMNS.map((c) => {
                const items = byColumn(c.id);
                const all = more[c.id];
                return (
                  <section key={c.id} className={`${tab === c.id ? "block" : "hidden"} rounded-xl border border-border bg-surface p-3 xl:block`} aria-label={c.title}>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden />
                      {c.title} ({items.length})
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">{c.hint}</p>
                    {items.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">Nothing here{rareCount && !showRare ? " among the must-have and common skills" : ""}.</p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-3">
                        {(all ? items : items.slice(0, SHOW)).map((s) => {
                          const r = reqOf(s.id)!;
                          return <SkillCard key={s.id} s={s} share={r.frequency} count={r.sourceJdIds.length} total={total} isNew={newIds.includes(s.id)} />;
                        })}
                      </ul>
                    )}
                    {items.length > SHOW && (
                      <button className="mt-2 text-sm text-accent" onClick={() => setMore((m) => ({ ...m, [c.id]: !all }))}>
                        {all ? "Show fewer" : `Show all ${items.length}`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>

            {rareCount > 0 && (
              <button className={`${secondaryBtn} self-start`} onClick={() => setShowRare((v) => !v)}>
                {showRare ? "Hide the rare skills" : `Also show ${rareCount} rare skills (asked for in under 30% of the job descriptions)`}
              </button>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/plan" className={`${primaryBtn} inline-block`}>
                Build my weekly plan from the Missing and Transferable skills
              </Link>
              <span className="text-sm text-muted">Next: a week-by-week plan that fits your hours.</span>
            </div>
          </>
        ) : (
          <Card title="Your skill map" hint="It appears here once you add a job description above.">
            <p className="text-sm text-muted">
              {profile.experience.length ? "Your background is saved. Add a job description to see where you stand." : "Tell your story first (step 1), then come back here."}
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
