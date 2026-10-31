// The optional Wispr Flow transform. Everything here is about recognising text it has sorted.
// Nothing in the app needs it: text without the header line is handled exactly as before.

// The prompt people paste into Wispr Flow, word for word.
export const TRANSFORM_PROMPT = `You tidy dictated text for Pivotin', a career-pivot coach. Do not summarise and do not drop facts.
1. Detect the type of text: INTRO (career story and goals), CHECKIN (weekly progress), APPLICATION (a job applied to) or INTERVIEW (an answer to an interview question).
2. If the type is INTERVIEW, return the text exactly as given, with only "#pivotin v1 - interview" added as the first line.
3. Otherwise, resolve any self-corrections that are still in the text ("three years, no, four" becomes four years).
4. Output a first line "#pivotin v1 - <type>" and then labelled lines.
   INTRO: Roles, Achievements, Tools, Current field, Target role, Hours per week, Deadline, Location, Salary floor, Constraints, Aside
   CHECKIN: Done, Skipped, Hours spent, Blockers, Mood, Aside
   APPLICATION: Company, Role, Channel, Date, Resume version, Status, Aside
5. Keep tangents and opinions under "Aside:" instead of deleting them, because a remark like "I hated the paperwork" is a career preference.
6. Add a "Corrections:" line listing every change you made.
7. Leave a field out if it was not mentioned. Never invent a value.`;

export const LABELS = {
  intro: ["Roles", "Achievements", "Tools", "Current field", "Target role", "Hours per week", "Deadline", "Location", "Salary floor", "Constraints", "Aside"],
  checkin: ["Done", "Skipped", "Hours spent", "Blockers", "Mood", "Aside"],
  application: ["Company", "Role", "Channel", "Date", "Resume version", "Status", "Aside"],
} as const;
export type TransformType = keyof typeof LABELS | "interview";

// The first line must start with #pivotin and a version ("v1"; "b1" is accepted too, in case a dictation tool hears the v as a b).
const HEADER = /^\s*#pivotin\s+[bv]\d+\b[^\n]*/i;

export const isTransformed = (text: string) => HEADER.test(text.split("\n")[0] ?? "");

export function transformType(text: string): TransformType | null {
  const line = text.split("\n")[0] ?? "";
  if (!HEADER.test(line)) return null;
  const t = line.toLowerCase().match(/-\s*(intro|checkin|check-in|application|interview)/)?.[1];
  return t === "check-in" ? "checkin" : ((t as TransformType | undefined) ?? null);
}

// The text without the transform's header line. For interview answers this is the answer exactly as spoken.
export const withoutHeader = (text: string) => (isTransformed(text) ? text.split("\n").slice(1).join("\n").trim() : text);

export type Example = { key: "intro" | "checkin" | "application"; title: string; before: string; after: string };
export const EXAMPLES: Example[] = [
  {
    key: "intro",
    title: "Telling your story",
    before:
      "I'm Arjun, I've been a manual QA engineer for three years, no, four years at an IT services company in Pune. I led user acceptance testing for a bank portal migration and I use Postman, Jira and SQL. I want to become an associate product manager within six months, by the end of April. I can do eight hours a week and I'd want at least twelve lakh a year, Pune or remote. Our office cricket match got rained out, anyway. I honestly hated the repetitive regression runs.",
    after: `#pivotin v1 - intro
Roles: Manual QA engineer at an IT services company, 4 years
Achievements: Led user acceptance testing for a bank portal migration
Tools: Postman, Jira, SQL
Current field: IT services, quality assurance
Target role: Associate product manager
Hours per week: 8
Deadline: End of April, about six months
Location: Pune
Salary floor: 12 lakh a year
Constraints: Pune or remote
Aside: Office cricket match got rained out. Hated the repetitive regression runs.
Corrections: "three years, no, four years" became 4 years`,
  },
  {
    key: "checkin",
    title: "Your weekly check-in",
    before:
      "This week I finished the roadmap skeleton and I did not get to the milestone document, I mean the draft roadmap document, because of a release crunch at work. About five hours in total. I felt okay about it, a bit tired honestly. The coffee machine broke again.",
    after: `#pivotin v1 - checkin
Done: Roadmap skeleton
Skipped: Draft roadmap document
Hours spent: 5
Blockers: Release crunch at work
Mood: Okay, a bit tired
Aside: The coffee machine broke again.
Corrections: "milestone document, I mean the draft roadmap document" became Draft roadmap document`,
  },
  {
    key: "application",
    title: "Logging an application",
    before:
      "Okay so I applied to Swiggy, no wait, to Zomato, through a referral yesterday with my version 2 resume. I really like how their delivery app works, by the way.",
    after: `#pivotin v1 - application
Company: Zomato
Channel: Referral
Date: Yesterday
Resume version: Version 2
Status: Applied
Aside: Likes how their delivery app works.
Corrections: "Swiggy, no wait, Zomato" became Zomato`,
  },
];
