"use client";

import { useState } from "react";
import { Chip } from "@/components/ui";
import { liveFit } from "@/lib/fit";
import { CHANNELS, STATUSES, STATUS_LABEL, type App, type Status } from "@/lib/tracker";
import type { PivotProfile } from "@/lib/types";

const input = "w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent";

// One application: the row the voice note became. Guessed fields are marked so they can be corrected.
export function AppRow({ app, profile, onStatus, onEdit, onRemove, fresh }: { app: App; profile: PivotProfile; onStatus: (s: Status) => void; onEdit: (patch: Partial<App>) => void; onRemove: () => void; fresh?: boolean }) {
  const fit = liveFit(profile, app);
  const guess = (f: string) => app.inferred.includes(f);
  const [open, setOpen] = useState(false);
  const cell = (label: string, value: string, field?: string) =>
    value ? (
      <Chip>
        <span className="text-muted">{label}: </span>
        {value}
        {field && guess(field) ? <span className="text-muted"> (a guess, check it)</span> : null}
      </Chip>
    ) : null;
  return (
    <li className={`rounded-lg border p-3 ${fresh ? "border-accent bg-accent-soft" : "border-border bg-bg"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {app.company}
            <span className="font-normal text-muted"> - {app.role}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted" title={fit.basis === "job description" ? "Worked out from this job description's skills and your bridge map" : "No job description for this one, so this is your overall readiness from the bridge map"}>
            Fit {fit.score}% ({fit.basis === "job description" ? "from its job description" : "from your overall map"})
            {app.dates.applied ? ` · applied ${new Date(app.dates.applied).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
          </p>
        </div>
        <label className="text-xs text-muted">
          <span className="sr-only">Status of {app.company}</span>
          <select value={app.status} onChange={(e) => onStatus(e.target.value as Status)} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cell("Kind", app.roleFamily, "roleFamily")}
        {cell("Stage", app.companyStage, "companyStage")}
        {cell("Industry", app.industry, "industry")}
        {cell("Applied via", app.channel)}
        {cell("Resume", app.resumeVersion)}
      </div>
      {app.notes && <p className="mt-2 text-sm text-muted">{app.notes}</p>}
      <button className="mt-2 text-xs text-accent" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Close" : "Edit details"}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ["Kind of role", "roleFamily"],
            ["Company stage", "companyStage"],
            ["Industry", "industry"],
            ["Resume version", "resumeVersion"],
          ] as const).map(([label, f]) => (
            <label key={f} className="text-xs text-muted">
              {label}
              <input defaultValue={app[f]} onBlur={(e) => e.target.value !== app[f] && onEdit({ [f]: e.target.value.trim(), inferred: app.inferred.filter((x) => x !== f) })} className={`${input} mt-0.5`} />
            </label>
          ))}
          <label className="text-xs text-muted">
            How you applied
            <select value={app.channel} onChange={(e) => onEdit({ channel: e.target.value })} className={`${input} mt-0.5`}>
              <option value="">Not said</option>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Notes
            <textarea defaultValue={app.notes} onBlur={(e) => e.target.value !== app.notes && onEdit({ notes: e.target.value.trim() })} rows={2} className={`${input} mt-0.5`} />
          </label>
          <button className="justify-self-start rounded-lg border border-border px-3 py-1.5 text-sm text-bad hover:bg-surface-2" onClick={onRemove}>
            Remove this application
          </button>
        </div>
      )}
    </li>
  );
}

// Two bars: how often the group heard back, and how often everything else did.
export function RateBars({ group, groupN, groupE, restN, restE, label }: { group: string; groupN: number; groupE: number; restN: number; restE: number; label: string }) {
  const bar = (name: string, e: number, n: number, tone: string) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 shrink-0 truncate" title={name}>
        {name}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${name}: ${e} of ${n} heard back`}>
        <div className={`h-full ${tone}`} style={{ width: `${n ? (e / n) * 100 : 0}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-muted">
        {e} of {n}
      </span>
    </div>
  );
  return (
    <div className="mt-2 flex flex-col gap-1.5" aria-label={label}>
      {bar(group, groupE, groupN, "bg-accent")}
      {bar("Everything else", restE, restN, "bg-muted")}
    </div>
  );
}
