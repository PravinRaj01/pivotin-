"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PivotProfile, emptyProfile } from "./types";
import { loadProfile, saveProfile, clearProfile } from "./storage";

type Ctx = {
  profile: PivotProfile;
  ready: boolean;
  update: (fn: (p: PivotProfile) => PivotProfile) => void;
  replace: (p: PivotProfile) => void;
  reset: () => void;
};

const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PivotProfile>(() => emptyProfile());
  const [ready, setReady] = useState(false);
  const latest = useRef(profile);

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) {
        latest.current = p;
        setProfile(p);
      }
      setReady(true);
    });
  }, []);

  const replace = useCallback((p: PivotProfile) => {
    latest.current = p;
    setProfile(p);
    saveProfile(p);
  }, []);

  const update = useCallback(
    (fn: (p: PivotProfile) => PivotProfile) => replace(fn(latest.current)),
    [replace],
  );

  const reset = useCallback(() => {
    clearProfile();
    replace(emptyProfile());
  }, [replace]);

  return <ProfileCtx.Provider value={{ profile, ready, update, replace, reset }}>{children}</ProfileCtx.Provider>;
}

export function useProfile(): Ctx {
  const c = useContext(ProfileCtx);
  if (!c) throw new Error("useProfile must be used inside ProfileProvider");
  return c;
}
