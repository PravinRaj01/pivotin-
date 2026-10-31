import type { PivotProfile, Skill } from "../types";
import analysis from "./arjun-analysis.json";
import generated from "./arjun-plan.json";
import interviewJson from "./arjun-interview.json";
import trackerJson from "./arjun-tracker.json";
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

// Sample tracker data: 15 invented applications (the companies are real, the roles, dates and outcomes are made up for
// the demo persona). 12 have been sent and 3 are saved. They are built so that ONE real pattern exists (referrals) and
// the other dimensions honestly do not clear the bar, which is what the analyst should say.
type Seed = Omit<PivotProfile["applications"][number], "id" | "dates" | "notes" | "followUps" | "source" | "inferred"> & {
  applied?: string;
  next?: string;
  notes?: string;
  followUps?: string[];
};
const PA = "Product analyst";
const APM = "Associate product manager";
const PM = "Product manager";
const seed: Seed[] = [
  { company: "Zomato", role: "Associate Product Manager", roleFamily: APM, companyStage: "Public or large company", industry: "Consumer internet", channel: "Referral", resumeVersion: "Version 2", status: "response", applied: "2026-09-28", next: "2026-11-04", location: "Gurugram", notes: "Recruiter screen booked. Prepare the 'why PM' story and the QA-to-product framing.", followUps: ["Rehearse the 'why PM' answer", "Read two recent product launches"] },
  { company: "Flipkart", role: "Associate Product Manager", roleFamily: APM, companyStage: "Public or large company", industry: "Consumer internet", channel: "Referral", resumeVersion: "Version 2", status: "interview", applied: "2026-09-15", next: "2026-11-07", location: "Bengaluru", notes: "Cleared the screen; product-sense round next. Under-prepared on metrics.", followUps: ["Practise 'improve X' and metric-drop questions"] },
  { company: "PhonePe", role: "Product Analyst", roleFamily: PA, companyStage: "Late stage", industry: "Fintech", channel: "Referral", resumeVersion: "Version 1", status: "interview", applied: "2026-10-20", location: "Pune", notes: "Pune office, analytics-leaning. Uses his SQL and payments knowledge." },
  { company: "Juspay", role: "Associate Product Manager", roleFamily: APM, companyStage: "Growth stage", industry: "Fintech", channel: "Referral", resumeVersion: "Version 1", status: "response", applied: "2026-10-24", location: "Bengaluru", notes: "Payments infrastructure; resume tailored to API testing experience." },
  { company: "CRED", role: "Associate Product Manager", roleFamily: APM, companyStage: "Late stage", industry: "Fintech", channel: "Referral", resumeVersion: "Version 2", status: "response", applied: "2026-10-05", next: "2026-11-05", location: "Bengaluru", notes: "Applied via referral from a college senior.", followUps: ["Thank the referrer"] },
  { company: "Paytm", role: "Product Management - Product Analyst - Telco", jdId: "j2", roleFamily: PA, companyStage: "Public or large company", industry: "Fintech", channel: "Careers page", resumeVersion: "Version 2", status: "response", applied: "2026-10-12", next: "2026-11-10", location: "Noida", notes: "Applied through the careers page with a note on payments testing.", followUps: ["Follow up if no reply by 10 Nov"] },
  { company: "Meesho", role: "Product Manager I", jdId: "j1", roleFamily: PM, companyStage: "Late stage", industry: "Consumer internet", channel: "Careers page", resumeVersion: "Version 2", status: "rejected", applied: "2026-09-30", location: "Bangalore", notes: "Stretch role. Strong on engineering and ownership, weak on research and metrics." },
  { company: "Freshworks", role: "Associate Product Manager", roleFamily: APM, companyStage: "Public or large company", industry: "Enterprise software", channel: "Careers page", resumeVersion: "Version 1", status: "rejected", applied: "2026-09-22", location: "Chennai", notes: "Rejected at resume stage; no feedback." },
  { company: "Okta", role: "Product Manager, Product Platform", jdId: "j4", roleFamily: PM, companyStage: "Public or large company", industry: "Enterprise software", channel: "Careers page", resumeVersion: "Version 2", status: "applied", applied: "2026-10-18", location: "Bengaluru", notes: "Strong on technical fluency, weak on product ownership." },
  { company: "Cleartax", role: "Associate Product Manager", roleFamily: APM, companyStage: "Growth stage", industry: "Fintech", channel: "Job board", resumeVersion: "Version 1", status: "rejected", applied: "2026-09-18", location: "Bengaluru", notes: "Auto-rejected. Wanted prior PM experience." },
  { company: "Zerodha", role: "Product Analyst", roleFamily: PA, companyStage: "Late stage", industry: "Fintech", channel: "Job board", resumeVersion: "Version 1", status: "rejected", applied: "2026-09-10", location: "Bengaluru", notes: "Rejected after the assignment: strong analysis, thin product framing." },
  { company: "Urban Company", role: "Associate Product Manager", jdId: "j8", roleFamily: APM, companyStage: "Late stage", industry: "Consumer internet", channel: "Job board", resumeVersion: "Version 2", status: "applied", applied: "2026-10-22", location: "Bangalore / Gurgaon", notes: "Marketplace background preferred; customer research story needed." },
  { company: "Groww", role: "Associate Product Manager", jdId: "j5", roleFamily: APM, companyStage: "Late stage", industry: "Fintech", channel: "", resumeVersion: "", status: "saved", location: "Bengaluru", notes: "Asks for 1-2 years of PM experience. Wait until the PRD and portfolio project are done.", followUps: ["Ask a referral who knows the team"] },
  { company: "Swiggy", role: "Associate Product Manager (Revenue & Growth)", jdId: "j6", roleFamily: APM, companyStage: "Late stage", industry: "Consumer internet", channel: "", resumeVersion: "", status: "saved", location: "Bengaluru", notes: "Promotions and discounts, a metrics-heavy charter. Referral first.", followUps: ["Message the former colleague who moved to PM there"] },
  { company: "Razorpay Curlec", role: "Associate Product Manager", jdId: "j7", roleFamily: APM, companyStage: "Growth stage", industry: "Fintech", channel: "", resumeVersion: "", status: "saved", location: "Kuala Lumpur", notes: "Payments domain fits his banking QA work. Needs relocation, so a stretch." },
];

const APPLICATIONS: PivotProfile["applications"] = seed.map(({ applied, next, notes, followUps, ...rest }, i) => ({
  ...rest,
  id: `a${i + 1}`,
  dates: { applied, nextStep: next },
  notes: notes ?? "",
  followUps: followUps ?? [],
  source: "Sample data",
  inferred: [],
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
  // Written by `npm run seed:arjun-tracker`: the analyst agent explaining the one pattern in his sample applications.
  applicationInsights: (trackerJson as { insights?: PivotProfile["applicationInsights"] }).insights,
  settings: { wisprProInstalled: false, personaId: "arjun" },
};
