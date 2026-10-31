import type { ReactNode } from "react";

// Shared building blocks so every screen uses the same card, heading and button styles.

export function Card({ title, hint, children, className = "" }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 md:p-5 ${className}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ScreenHeader({ step, title, line }: { step: number; title: string; line: string }) {
  return (
    <header className="mb-5">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>Step {step} of 8</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={8}>
          <div className="h-full bg-accent" style={{ width: `${(step / 8) * 100}%` }} />
        </div>
      </div>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-muted">{line}</p>
    </header>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">{children}</span>;
}

export const primaryBtn =
  "rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-text disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryBtn =
  "rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-50";
