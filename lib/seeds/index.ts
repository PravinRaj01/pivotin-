import type { PivotProfile } from "../types";
import { arjun } from "./arjun";
import { teacher } from "./teacher";

export const PERSONAS: { id: string; label: string; blurb: string; profile: PivotProfile }[] = [
  { id: "arjun", label: "Arjun", blurb: "QA engineer to Associate PM, Pune", profile: arjun },
  { id: "teacher", label: "Hannah", blurb: "Teacher to UX designer, Leeds", profile: teacher },
];
