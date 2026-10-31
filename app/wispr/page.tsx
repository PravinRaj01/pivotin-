"use client";

import Link from "next/link";
import { useState } from "react";
import { TransformBadge } from "@/components/TransformBadge";
import { Card, ScreenHeader, primaryBtn, secondaryBtn } from "@/components/ui";
import { useProfile } from "@/lib/profile-context";
import { EXAMPLES, TRANSFORM_PROMPT } from "@/lib/transform";

const STEPS = [
  { title: "Copy our prompt", body: "Press the button in the box below. It copies the whole prompt." },
  { title: "Open Flow", body: "Open Wispr Flow on your computer." },
  { title: "Go to Transform", body: "In Flow, go to Transform." },
  { title: "Create your own", body: "Choose to create your own transform." },
  { title: "Paste it", body: "Paste the prompt in and save it. From then on, dictate as usual and use the transform when you want your speech sorted." },
];

export default function WisprPage() {
  const { profile, update } = useProfile();
  const [ticked, setTicked] = useState<boolean[]>([false, false, false, false, false]);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const [tab, setTab] = useState(0);
  const ex = EXAMPLES[tab];
  const doneCount = ticked.filter(Boolean).length;
  const installed = profile.settings.wisprProInstalled;

  const tick = (i: number, v: boolean) => setTicked((t) => t.map((x, j) => (j === i ? v : x)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TRANSFORM_PROMPT);
      setCopied("ok");
      tick(0, true);
    } catch {
      // clipboard blocked: select the text so Ctrl+C works
      (document.getElementById("transform-prompt") as HTMLTextAreaElement | null)?.select();
      setCopied("fail");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <div>
      <ScreenHeader
        step={8}
        title="Speak Better with Wispr Flow"
        line="An optional transform for Wispr Flow that sorts and labels what you dictate, so Pivotin' reads it more reliably. Everything in Pivotin' works fully without it."
      />

      <div className="flex flex-col gap-5">
        <Card title="Do you need this?" hint="No. It is a bonus for people who use Wispr Pro.">
          <ul className="list-disc pl-5 text-sm leading-relaxed">
            <li>Wispr Flow already removes filler words and fixes simple slips. This transform does not do that again: it only sorts and labels.</li>
            <li>It is the same for every role. It keeps every fact, and keeps your side remarks under &ldquo;Aside&rdquo;, because a comment like &ldquo;I hated the paperwork&rdquo; tells me what to avoid for you.</li>
            <li>Skip it and nothing changes. Every screen takes plain speech exactly as before.</li>
            <li>Interview answers ignore it. They are always scored as you said them.</li>
          </ul>
        </Card>

        <Card title="Set it up in 5 steps" hint={`Step ${Math.min(doneCount + 1, 5)} of 5. Tick each one as you go.`}>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={5}>
            <div className="h-full bg-accent transition-all" style={{ width: `${(doneCount / 5) * 100}%` }} />
          </div>
          <ol className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={ticked[i]} onChange={(e) => tick(i, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                  <span>
                    <span className="block text-sm font-medium">
                      {i + 1}. {s.title}
                    </span>
                    <span className="block text-sm text-muted">{s.body}</span>
                  </span>
                </label>
                {i === 0 && (
                  <div className="mt-3">
                    <textarea id="transform-prompt" readOnly value={TRANSFORM_PROMPT} rows={12} className="w-full resize-y rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed" aria-label="The Pivotin' transform prompt" />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button className={primaryBtn} onClick={copy}>
                        Copy the prompt
                      </button>
                      <span className="text-sm" role="status" aria-live="polite">
                        {copied === "ok" ? "Copied. Now open Flow." : copied === "fail" ? "Your browser blocked copying. The text is selected: press Ctrl+C (or Cmd+C)." : ""}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={installed ? secondaryBtn : primaryBtn} onClick={() => update((p) => ({ ...p, settings: { ...p.settings, wisprProInstalled: !installed } }))}>
              {installed ? "Marked as set up. Undo" : "I have set it up"}
            </button>
            <span className="text-sm text-muted">{installed ? "Nice. You can still ignore it any time." : "Optional. This only ticks the step off in your journey."}</span>
          </div>
        </Card>

        <Card title="Before and after" hint="What you say stays the same. Only the way it is written down changes.">
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Examples">
            {EXAMPLES.map((e, i) => (
              <button key={e.key} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`flex-1 rounded-lg border px-2 py-2 text-sm ${tab === i ? "border-accent bg-accent-soft font-medium" : "border-border text-muted"}`}>
                {e.title}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-bg p-3" aria-label="Before">
              <h3 className="text-sm font-semibold">Before: what Flow types</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{ex.before}</p>
            </section>
            <section className="rounded-lg border border-border p-3" aria-label="After">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">After: with the transform</h3>
                <TransformBadge text={ex.after} />
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{ex.after}</pre>
            </section>
          </div>
          <p className="mt-3 text-sm text-muted">
            Notice that the self-correction is resolved and listed under Corrections, the side remarks are kept under Aside, and anything you did not mention is simply left out.
          </p>
        </Card>

        <Card title="How Pivotin' recognises it" hint="By one line, nothing more.">
          <p className="text-sm">
            If the text you give Pivotin&apos; starts with a line like <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">#pivotin v1</code>, you see this small badge next to it: <TransformBadge text={"#pivotin v1 - intro"} />
          </p>
          <p className="mt-2 text-sm text-muted">Text without that line works just the same, with no badge. Interview answers are the exception to the badge: they never show it, and the line is dropped before scoring.</p>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/intake" className={`${primaryBtn} inline-block`}>
            Back to Tell your story
          </Link>
          <Link href="/plan" className={`${secondaryBtn} inline-block`}>
            See my plan
          </Link>
        </div>
      </div>
    </div>
  );
}
