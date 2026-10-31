import { PivotProfile, PivotProfileSchema } from "./types";

// The only file that knows where the profile lives. Everything is async so phase 9
// can swap the internals for Neon without touching a caller.

const KEY = "pivotin.profile.v1";

export async function loadProfile(): Promise<PivotProfile | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = PivotProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: PivotProfile): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }));
  } catch {
    // Storage full or blocked; the in-memory profile still works for this session.
  }
}

export async function clearProfile(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function exportJson(profile: PivotProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function importJson(text: string): PivotProfile {
  const parsed = PivotProfileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("That file is not a Pivotin' profile.");
  return parsed.data;
}
