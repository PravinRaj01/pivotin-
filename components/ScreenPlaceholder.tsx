export function ScreenPlaceholder({ step, title, line }: { step: number; title: string; line: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <p className="text-sm text-muted">Step {step} of 8</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">{line}</p>
    </section>
  );
}
