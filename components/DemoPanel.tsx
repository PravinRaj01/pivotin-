"use client";

import { useRef, useState } from "react";
import { PERSONAS } from "@/lib/seeds";
import { useProfile } from "@/lib/profile-context";
import { exportJson, importJson } from "@/lib/storage";

const btn = "w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-text";

export function DemoPanel() {
  const { profile, replace, reset } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const load = (id: string) => {
    const p = PERSONAS.find((x) => x.id === id);
    if (p) replace(structuredClone(p.profile));
  };

  const download = () => {
    const blob = new Blob([exportJson(profile)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pivotin-${profile.person.name || "profile"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      replace(importJson(await f.text()));
      setMsg("Profile imported.");
    } catch (e) {
      setMsg((e as Error).message || "Could not read that file.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-2">
      <h2 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Demo and data</h2>
      <button className={btn} onClick={() => load("arjun")}>
        Reset demo
        <span className="block text-xs">Reload Arjun, {PERSONAS[0].blurb}</span>
      </button>
      <button
        className={btn}
        onClick={() => {
          if (confirm("Start as someone new? This clears the profile on this device and begins empty.")) reset();
        }}
      >
        Start as someone new
        <span className="block text-xs">Empty profile, tell your own story</span>
      </button>
      <button className={btn} onClick={() => load("teacher")}>
        Load the teacher example
        <span className="block text-xs">{PERSONAS[1].blurb}, preloaded fallback</span>
      </button>
      <button className={btn} onClick={download}>
        Export profile (JSON)
      </button>
      <button className={btn} onClick={() => fileRef.current?.click()}>
        Import profile (JSON)
      </button>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {msg && <p className="px-2 pt-1 text-xs text-muted">{msg}</p>}
    </section>
  );
}
