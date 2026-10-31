"use client";

import Link from "next/link";
import { Card, Chip, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { toggleMilestone } from "@/lib/plan";
import { useProfile } from "@/lib/profile-context";

// "Situation: ... What I did: ... Result: [blank]" -> three labelled parts; blanks are shown as fill-in boxes.
function Story({ text }: { text: string }) {
  const parts = text.split(/(Situation:|What I did:|Result:)/).map((s) => s.trim()).filter(Boolean);
  const labelled: { label: string; body: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (/^(Situation:|What I did:|Result:)$/.test(parts[i]) && parts[i + 1]) labelled.push({ label: parts[i].replace(":", ""), body: parts[++i] });
    else if (!labelled.length) labelled.push({ label: "", body: parts[i] });
  }
  const blanks = (body: string) =>
    body.split(/(\[[^\]]+\])/).map((chunk, i) =>
      /^\[[^\]]+\]$/.test(chunk) ? (
        <span key={i} className="rounded border border-dashed border-accent bg-accent-soft px-1.5 py-0.5 text-sm not-italic">
          {chunk}
        </span>
      ) : (
        <span key={i}>{chunk}</span>
      ),
    );
  return (
    <div className="space-y-2">
      {labelled.map((l, i) => (
        <p key={i} className="text-sm leading-relaxed">
          {l.label && <span className="mr-1.5 font-medium">{l.label}:</span>}
          {blanks(l.body)}
        </p>
      ))}
    </div>
  );
}

const STATUS = { suggested: "Not started", active: "In progress", done: "Done" } as const;

export default function ProjectsPage() {
  const { profile, update } = useProfile();
  const labels = new Map(profile.skills.map((s) => [s.id, s]));
  const projects = profile.projects;

  return (
    <div>
      <ScreenHeader
        step={4}
        title="Portfolio projects"
        line="Each project closes two or three of your biggest skill gaps, builds on your old field, and leaves you with a story to tell in interviews."
      />

      <div className="flex flex-col gap-5">
        {projects.length === 0 ? (
          <Card title="Your projects" hint="Projects are chosen when your plan is built, so each milestone week has real work to do.">
            <Link href="/plan" className={`${primaryBtn} inline-block`}>
              {profile.plan.weeks.length ? "Re-plan to choose projects" : "Build my plan first"}
            </Link>
          </Card>
        ) : (
          projects.map((pr) => {
            const doneN = pr.milestones.filter((m) => m.done).length;
            const pct = pr.milestones.length ? Math.round((doneN / pr.milestones.length) * 100) : 0;
            return (
              <Card key={pr.id} title={pr.title} hint={pr.pitch}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5">{STATUS[pr.status]}</span>
                  <span>
                    {doneN} of {pr.milestones.length} milestones, about {pr.scopeHours} hours in total
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <section className="rounded-lg border border-border p-3" aria-label="Gaps it closes">
                    <h3 className="text-sm font-semibold">Gaps it closes</h3>
                    <ul className="mt-2 flex flex-col gap-2">
                      {pr.skillIds.map((id) => {
                        const s = labels.get(id);
                        return (
                          <li key={id} className="text-sm">
                            {s?.label ?? id}
                            {s && (
                              <span className="block text-xs text-muted">
                                Level {s.current} of 3 now, the role asks {s.required}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  <section className="rounded-lg border border-border p-3" aria-label="Builds on your old field">
                    <h3 className="text-sm font-semibold">Builds on your old field</h3>
                    <p className="mt-2 text-sm">{pr.oldFieldAngle || "Uses the problems and tools from your previous work."}</p>
                    {pr.deliverable && (
                      <p className="mt-2 text-xs text-muted">
                        You finish with: <span className="text-text">{pr.deliverable}</span>
                      </p>
                    )}
                  </section>
                </div>

                <section className="mt-4 rounded-lg border border-border bg-bg p-3" aria-label="Your interview story">
                  <h3 className="text-sm font-semibold">Your interview story</h3>
                  <p className="mt-0.5 text-xs text-muted">Fill the boxes in with your real results once the project is done. I do not make up a result for you.</p>
                  <div className="mt-2">
                    <Story text={pr.interviewStory || "Situation: [describe the problem you started from]. What I did: [what you built]. Result: [what changed, with a number]"} />
                  </div>
                </section>

                <section className="mt-4" aria-label="Milestones">
                  <h3 className="text-sm font-semibold">Milestones</h3>
                  <ol className="mt-1 divide-y divide-border">
                    {pr.milestones.map((m, i) => (
                      <li key={i} className="flex gap-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={m.done}
                          onChange={() => update((p) => toggleMilestone(p, pr.id, i))}
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                          aria-label={`Mark done: ${m.title}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${m.done ? "text-muted line-through" : ""}`}>{m.title}</p>
                          <p className="mt-0.5 text-xs text-muted">{m.week ? `Week ${m.week}${m.hours ? `, ${m.hours} h` : ""}` : "Not scheduled in this plan"}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </Card>
            );
          })
        )}

        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/interview" className={`${primaryBtn} inline-block`}>
              Practise telling these stories
            </Link>
            <Link href="/plan" className={`${secondaryBtn} inline-block`}>
              Back to my plan
            </Link>
            <span className="text-sm text-muted">Next: mock interviews, where you rehearse your project stories out loud.</span>
          </div>
        )}
      </div>
    </div>
  );
}
