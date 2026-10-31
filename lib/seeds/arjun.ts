import type { PivotProfile, Skill } from "../types";
import analysis from "./arjun-analysis.json";
import generated from "./arjun-plan.json";
import interviewJson from "./arjun-interview.json";
import { makeSkills, reqFromSkills } from "./build";

// Demo persona (fictional). Target JDs are the 8 in seeds/jds; the two in seeds/jds-demo-holdout
// are deliberately NOT here so they can be pasted live as unseen roles.

const T = "2026-10-31T09:00:00.000Z";

const jds = [
  ["j1", "Product Manager I", "Meesho", "Bangalore. Product Manager I on a team focused on customers in tier 2-4 towns: problem discovery, user-first decisions, impact over features, working with engineering and design.", "Lever"],
  ["j2", "Product Analyst, Telco", "Paytm", "Noida. Product analyst in the telco team: analysis and metrics for recharge and telco products, working with product and business teams.", "Lever"],
  ["j3", "Product Manager II, Travel", "Paytm", "Noida. Early-career PM taking ownership of a product pod: customer problems, priorities, working with design and engineering, launches and iteration.", "Lever"],
  ["j4", "Product Manager, Product Platform", "Okta", "Bengaluru. Platform PM at an enterprise identity company: technical depth, working with engineering, customers and internal teams on platform capabilities.", "Greenhouse"],
  ["j5", "Associate Product Manager", "Groww", "Bengaluru, on-site. 1-2 years of PM experience asked for; user-centred product strategy, collaboration across engineering, design, analytics, finance and compliance. Source text is partly cut off.", "Unstop"],
  ["j6", "Associate Product Manager (Revenue & Growth)", "Swiggy", "Bengaluru. APM for promotions and discounts in a three-sided marketplace (consumers, restaurants, delivery partners); works with engineering, design, data science and business. Listing closed.", "startup.jobs"],
  ["j7", "Associate Product Manager", "Razorpay Curlec", "Kuala Lumpur, Malaysia (outside India). Payments APM at a Malaysian recurring-payments company acquired by Razorpay.", "Company site"],
  ["j8", "Associate Product Manager", "Urban Company", "Bangalore / Gurgaon. 1+ year experience, e-commerce or start-up background preferred, strong business sense and problem solving, customer empathy, grounding decisions in data. Listing closed and old.", "Instahyre"],
].map(([id, title, company, gist, source]) => ({
  id,
  title,
  company,
  rawText: `${gist} [Summary written from a public posting via ${source}; full text is not bundled.]`,
  addedAt: T,
}));

const handSkills = makeSkills([
  ["stakeholders", "Stakeholder & cross-functional collaboration", "soft", 2, 3, ["Coordinated with developers, BAs and the client's UAT team on every release at work."]],
  ["research", "User / customer research & empathy", "craft", 1, 3, ["Sat in on two client demos, but has never run a user interview."]],
  ["communication", "Written & verbal communication", "soft", 3, 3, ["Writes clear bug reports and release notes; presents defect summaries to the client weekly."]],
  ["engineering", "Engineering / technical fluency", "technical", 3, 3, ["Four years testing APIs and web apps; reads logs, uses Postman, knows the release pipeline."]],
  ["sql", "SQL / data analysis", "technical", 2, 3, ["Writes SELECT and JOIN queries to verify test data; no analysis or dashboards yet."]],
  ["strategy", "Product strategy & roadmap", "craft", 0, 2, []],
  ["problem", "Problem solving / first principles", "soft", 3, 3, ["Root-caused a recurring payment-gateway defect that three teams had closed as 'cannot reproduce'."]],
  ["metrics", "Metrics / KPIs & business acumen", "domain", 1, 3, ["Tracks defect leakage and test coverage, but not product or business metrics."]],
  ["specs", "Specs, PRDs & user stories", "craft", 1, 3, ["Reads user stories daily to write test cases; has never authored one."]],
  ["experimentation", "Experimentation / A/B testing", "technical", 1, 2, ["Understands test design from QA; no exposure to statistical A/B tests."]],
  ["gtm", "Go-to-market & launch", "domain", 0, 1, []],
  ["ai", "AI / ML familiarity", "technical", 1, 2, ["Has used ChatGPT to draft test cases."]],
  ["prioritization", "Prioritization", "craft", 2, 3, ["Triages bugs by severity and release risk every sprint."]],
  ["ownership", "Ownership & ambiguity", "soft", 2, 3, ["Led UAT for a client portal migration with unclear requirements."]],
]);

const freq = {
  stakeholders: 1, research: 1, communication: 0.88, engineering: 0.88, sql: 0.75, strategy: 0.75,
  problem: 0.75, metrics: 0.75, specs: 0.63, experimentation: 0.63, gtm: 0.5, ai: 0.38,
  prioritization: 0.38, ownership: 0.38,
};

// Written by `npm run seed:arjun`: the JD agent's skill counts across the 8 seed job descriptions and the
// bridge agent's columns for Arjun. Hand-written skills above are only the fallback and the label list.
const analysed = ((analysis as { skills?: unknown[] }).skills?.length ?? 0) > 0;
const skills: Skill[] = analysed ? (analysis.skills as Skill[]) : handSkills;
const requirements = analysed
  ? (analysis.requirements as PivotProfile["targetRole"]["requirements"])
  : reqFromSkills(handSkills, freq, jds.map((j) => j.id));

const RESUME = `Arjun
Manual QA Engineer, Pune, India

Summary
Four years testing banking and payments applications for enterprise clients. Good at finding the real cause of a defect and at working with developers, business analysts and client UAT teams.

Experience
Kestrel Systems (IT services), Pune. Manual QA Engineer, 2022 - present
- Led user acceptance testing for a bank's client portal migration across three teams.
- Root-caused a recurring payment-gateway defect that earlier teams had closed as cannot reproduce.
- Wrote a reusable regression suite for the payments flow and cut the regression cycle time.
- Wrote test cases from user stories and acceptance criteria for retail banking features.
- Triaged defects by severity and release risk in every sprint, and presented a weekly defect summary to the client.
- Built an Excel tracker of defect trends that the delivery manager used in weekly reviews.

Kestrel Systems (IT services), Pune. Associate QA Engineer, 2022 - 2023
- Wrote and executed more than 400 test cases on a retail banking app.

Tools
Postman, Jira, TestRail, Confluence, SQL (SELECT and JOIN queries to verify test data), Selenium (basic)

Education
B.E. Computer Engineering`;

// Written by `npm run seed:arjun-plan`: the plan, projects and prerequisites the planner built for Arjun
// (week 1 to 6 ticked off, so he opens on week 7). Empty until that script has run.
type Built = { skills?: Skill[]; plan?: PivotProfile["plan"]; projects?: PivotProfile["projects"] };
const built = generated as Built;
// Written by `npm run seed:arjun-interview`: the rubric the agent wrote for his role and one interview in progress.
const builtInterview = interviewJson as { rubric?: PivotProfile["rubric"]; interviews?: PivotProfile["interviews"] };
const hasPlan = (built.plan?.weeks?.length ?? 0) > 0;
const finalSkills: Skill[] = hasPlan && built.skills ? built.skills : skills;

// Sample tracker data. Companies are real; the roles and outcomes are invented for the demo persona.
type AppRow = [company: string, role: string, status: string, location: string, notes: string, applied?: string, nextStep?: string, fit?: number, jdId?: string, followUps?: string[]];
const apps: AppRow[] = [
  ["Groww", "Associate Product Manager", "saved", "Bengaluru", "Asks for 1-2 years of PM experience. Wait until the PRD and portfolio project are done.", undefined, undefined, 52, "j5", ["Ask a referral who knows the team"]],
  ["Swiggy", "Associate Product Manager (Revenue & Growth)", "saved", "Bengaluru", "Promotions and discounts, a metrics-heavy charter. Referral first.", undefined, undefined, 48, "j6", ["Message the former colleague who moved to PM there"]],
  ["Urban Company", "Associate Product Manager", "saved", "Bangalore / Gurgaon", "Marketplace background preferred; customer research story needed.", undefined, undefined, 55, "j8"],
  ["Razorpay Curlec", "Associate Product Manager", "saved", "Kuala Lumpur", "Payments domain fits his banking QA work. Needs relocation, so a stretch.", undefined, undefined, 50, "j7"],
  ["Okta", "Product Manager, Product Platform", "saved", "Bengaluru", "Strong on technical fluency, weak on product ownership. Revisit after the project.", undefined, undefined, 40, "j4"],
  ["Meesho", "Product Manager I", "saved", "Bangalore", "Stretch role. Strong on engineering and ownership, weak on research and metrics.", undefined, undefined, 45, "j1"],
  ["Paytm", "Product Analyst, Telco", "applied", "Noida", "Applied through the careers page with a note on payments testing.", "2026-10-12", "2026-11-10", 58, "j2", ["Follow up if no reply by 10 Nov"]],
  ["CRED", "Associate Product Manager", "applied", "Bengaluru", "Applied via referral from a college senior.", "2026-10-05", "2026-11-05", 50, undefined, ["Thank the referrer"]],
  ["PhonePe", "Product Analyst", "applied", "Pune", "Pune office, analytics-leaning. Uses his SQL and payments knowledge.", "2026-10-20", undefined, 56],
  ["Juspay", "Associate Product Manager", "applied", "Bengaluru", "Payments infrastructure; resume tailored to API testing experience.", "2026-10-24", undefined, 54],
  ["Zomato", "Associate Product Manager", "screen", "Gurugram", "Recruiter screen booked. Prepare the 'why PM' story and the QA-to-product framing.", "2026-09-28", "2026-11-04", 49, undefined, ["Rehearse the 'why PM' answer", "Read two recent product launches"]],
  ["Flipkart", "Associate Product Manager", "interview", "Bengaluru", "Cleared the screen; product-sense round next. Under-prepared on metrics.", "2026-09-15", "2026-11-07", 47, undefined, ["Practise 'improve X' and metric-drop questions"]],
  ["Zerodha", "Product Analyst", "rejected", "Bengaluru", "Rejected after the assignment: strong analysis, thin product framing. Lesson: add recommendations, not just numbers.", "2026-09-10", undefined, 44],
  ["Cleartax", "Associate Product Manager", "rejected", "Bengaluru", "Auto-rejected. Wanted prior PM experience.", "2026-09-18", undefined, 38],
  ["Freshworks", "Associate Product Manager", "rejected", "Chennai", "Rejected at resume stage; no feedback. Resume reframe is on the plan for week 19.", "2026-09-22", undefined, 41],
];

const APPLICATIONS: PivotProfile["applications"] = apps.map(([company, role, status, location, notes, applied, nextStep, fitScore, jdId, followUps], i) => ({
  id: `a${i + 1}`,
  company,
  role,
  jdId,
  status: status as PivotProfile["applications"][number]["status"],
  dates: { applied, nextStep },
  fitScore,
  notes,
  followUps: followUps ?? [],
  location,
  source: jdId ? "Seed job description" : "Added by hand",
}));

export const arjun: PivotProfile = {
  version: 1,
  id: "persona-arjun",
  createdAt: T,
  updatedAt: T,
  person: {
    name: "Arjun",
    location: "Pune, India",
    yearsExperience: 4,
    currentRole: "Manual QA Engineer",
    currentIndustry: "IT services",
    education: "B.E. Computer Engineering",
    resume: RESUME,
  },
  goal: {
    targetRole: "Associate Product Manager",
    targetIndustry: "Fintech or consumer tech",
    timelineWeeks: 26,
    hoursPerWeek: 8,
    deadline: "2027-04-30",
    salaryFloor: { amount: 1200000, currency: "INR", period: "year" },
    cities: ["Pune", "Remote"],
    alternateRoles: ["Product Analyst", "Business Analyst"],
    motivation: "I keep finding the bugs that come from unclear requirements. I want to be the person who decides what gets built, not the one who finds out it was wrong at the end.",
    constraints: ["Full-time job, so evenings and weekends only", "Prefers to stay in Pune or work remote"],
  },
  story: {
    rawTranscripts: [
      {
        id: "t1",
        at: T,
        text: "I'm Arjun, I've been a manual QA engineer for about four years at an IT services company here in Pune. Mostly banking and payments clients. I'm good at finding what breaks, but honestly the bugs I see most are not code bugs, they're requirement bugs. Somebody never asked the user what they wanted. Last weekend our office cricket match got rained out and everyone argued about the umpire, anyway. I want to become an associate product manager in six months. Actually no, let me say by the end of April, that lines up with appraisal season. I can do maybe ten hours a week. No, eight, with the on-call weeks it's eight. I'd want at least twelve lakh a year, Pune or remote. I hate the repetitive regression runs, they drain me, but I love when I get to dig into a weird defect and find the real cause. I'm scared my background is too testing-heavy and that nobody will see me as a product person.",
      },
    ],
    summary: "Four years of manual QA on banking and payments projects in Pune. Strong at spotting what breaks and at working with developers; wants to move upstream to deciding what gets built.",
    strengths: ["Finds root causes others close as 'cannot reproduce'", "Clear written communication", "Knows how software ships"],
    fears: ["Background is too testing-heavy", "No product ownership on the resume", "Only 8 hours a week"],
    corrections: [
      { topic: "Deadline", was: "six months", now: "end of April" },
      { topic: "Hours per week", was: "10", now: "8" },
    ],
    roleSuggestions: [],
    followUp: null,
    preferences: [
      { text: "Wants to shape what gets built, not find out at the end that it was wrong", kind: "value" },
      { text: "Prefers to stay in Pune or work remote", kind: "limit" },
      { text: "Hates repetitive regression runs", kind: "dislike" },
      { text: "Loves digging into a weird defect to find the real cause", kind: "like" },
    ],
  },
  experience: [
    {
      id: "e1",
      role: "Manual QA Engineer",
      org: "Kestrel Systems (IT services)",
      period: "2022 - present",
      achievements: [
        "Led UAT for a bank's client portal migration across three teams",
        "Root-caused a recurring payment-gateway defect that earlier teams closed as 'cannot reproduce'",
        "Cut regression cycle time by writing a reusable test suite for the payments flow",
      ],
      toolsUsed: ["Postman", "Jira", "SQL", "TestRail", "Confluence"],
    },
    {
      id: "e2",
      role: "Associate QA Engineer",
      org: "Kestrel Systems (IT services)",
      period: "2022 - 2023",
      achievements: ["Wrote and executed 400+ test cases on a retail banking app"],
      toolsUsed: ["Jira", "Excel", "Selenium (basic)"],
    },
  ],
  targetRole: { jds, requirements },
  skills: finalSkills,
  plan: hasPlan ? built.plan! : { generatedAt: T, revision: 0, weeks: [], uncovered: [], changelog: [] },
  projects: hasPlan ? (built.projects ?? []) : [],
  rubric: builtInterview.rubric,
  interviews: builtInterview.interviews ?? [],
  checkins: [
    {
      id: "c1",
      weekN: 5,
      at: T,
      transcript: "Finished the follow-up interviews and sent out the survey for my banking checkout project, but I ran out of time to write up the themes because of a release crunch. About six hours this week.",
      parsed: {
        hoursSpent: 6,
        completedTaskIds: built.plan?.weeks.find((w) => w.n === 5)?.tasks.slice(0, 2).map((t) => t.id) ?? [],
        blockers: ["Release crunch at work"],
        mood: 3,
        skippedTaskIds: [],
        plannedHours: 8,
        wins: ["Interviews done and survey out"],
        notes: "Missed two hours; the write-up of themes moves to next week.",
      },
      planAdjustments: ["Moved the theme write-up to week 6"],
    },
  ],
  applications: APPLICATIONS,
  settings: { wisprProInstalled: false, personaId: "arjun" },
};
