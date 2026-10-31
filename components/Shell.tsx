"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ALL_SCREENS, NAV_GROUPS } from "@/lib/nav";
import { useProfile } from "@/lib/profile-context";
import { readiness } from "@/lib/types";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pivotin.theme");
      const isDark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    } catch {}
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("pivotin.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text"
      aria-label="Toggle dark mode"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const current = ALL_SCREENS.find((s) => path.startsWith(s.href));
  const pct = readiness(profile);

  useEffect(() => setOpen(false), [path]);

  const nav = (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((g) => (
        <section key={g.title} className="rounded-xl border border-border bg-surface p-2">
          <h2 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
          <ul>
            {g.items.map((it) => {
              const active = path.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                      active ? "bg-accent-soft font-medium text-text" : "text-muted hover:text-text"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                        active ? "bg-accent text-accent-text" : "bg-surface-2"
                      }`}
                    >
                      {it.step}
                    </span>
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-4 md:flex-row md:px-6 md:py-6">
      <header className="flex items-center justify-between md:hidden">
        <Link href="/" className="text-lg font-semibold">
          Pivotin&apos;
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
            aria-expanded={open}
          >
            {current ? `${current.step}/8 ${current.label}` : "Menu"}
          </button>
        </div>
      </header>

      <aside className={`${open ? "block" : "hidden"} md:block md:w-64 md:shrink-0`}>
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="hidden items-center justify-between md:flex">
            <Link href="/" className="text-xl font-semibold">
              Pivotin&apos;
            </Link>
            <ThemeToggle />
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">Pivot readiness</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-medium">{pct}%</span>
            </div>
          </div>
          {nav}
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
