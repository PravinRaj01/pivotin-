import type { PivotProfile, Skill } from "../types";
import analysis from "./arjun-analysis.json";
import { makeSkills, makeWeeks, reqFromSkills } from "./build";

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

const weeks = makeWeeks(
  [
    ["Understand the APM role", [["Read 3 APM JDs closely and highlight what repeats", 3, ["strategy"]], ["Write a one-page 'why PM' story in your own words", 2, ["communication"]], ["Shadow one product meeting at work", 3, ["stakeholders"]]]],
    ["Product thinking basics", [["Course: product management fundamentals, modules 1-3", 5, ["strategy"]], ["Teardown: pick an app you use and list 5 product decisions", 3, ["problem"]]]],
    ["User research 101", [["Learn the interview method (The Mom Test, summary)", 3, ["research"]], ["Run 2 practice user interviews with friends", 5, ["research"]]]],
    ["SQL for product questions", [["SQL practice: aggregates, joins, window functions (10 problems)", 5, ["sql"]], ["Answer 3 product questions with a public dataset", 3, ["sql", "metrics"]]]],
    ["Metrics and funnels", [["Learn AARRR, north-star, input vs output metrics", 3, ["metrics"]], ["Define metrics for a food-delivery checkout", 5, ["metrics"]]]],
    ["Writing specs", [["Study 3 public PRD examples", 3, ["specs"]], ["Write a PRD for a small feature of an app you use", 5, ["specs"]]]],
    ["Your first PRD, reviewed", [["Share the PRD with an engineer and a PM; collect feedback", 3, ["specs", "stakeholders"]], ["Revise the PRD and add success metrics", 5, ["specs", "metrics"]]]],
    ["Prioritization frameworks", [["Learn RICE, MoSCoW and impact/effort", 3, ["prioritization"]], ["Prioritize a 10-item backlog and defend it in writing", 5, ["prioritization", "communication"]]]],
    ["Experimentation", [["Learn A/B test design: hypothesis, sample size, guardrails", 4, ["experimentation"]], ["Design an experiment for a signup flow change", 4, ["experimentation"]]]],
    ["Portfolio project kickoff", [["Choose a portfolio project and scope it to 20 hours", 2, ["strategy"]], ["Research the problem: 3 interviews, 1 competitor scan", 6, ["research"]]]],
    ["Portfolio project build I", [["Write problem statement and success metrics", 3, ["specs", "metrics"]], ["Sketch solution options and pick one", 5, ["strategy", "problem"]]]],
    ["Portfolio project build II", [["Draft PRD and a simple prototype", 6, ["specs"]], ["Review with an engineer for feasibility", 2, ["engineering", "stakeholders"]]]],
    ["Roadmaps and strategy", [["Learn roadmap formats (now/next/later)", 3, ["strategy"]], ["Build a 3-quarter roadmap for your portfolio product", 5, ["strategy"]]]],
    ["Go-to-market basics", [["Learn launch checklists, positioning and rollout plans", 4, ["gtm"]], ["Write a launch plan for your portfolio feature", 4, ["gtm"]]]],
    ["AI and product", [["Learn what LLM features are good and bad at", 3, ["ai"]], ["Spec one AI feature with failure modes and evals", 5, ["ai", "specs"]]]],
    ["Behavioral interviews", [["Draft 6 STAR stories from QA work, reframed for product", 4, ["communication", "ownership"]], ["Mock interview x2", 4, ["communication"]]]],
    ["Product sense interviews", [["Practice 'improve X' and 'design Y' questions", 4, ["problem", "research"]], ["Mock product-sense interview x2", 4, ["problem"]]]],
    ["Metrics and analytics interviews", [["Practice metric-drop and success-metric questions", 4, ["metrics"]], ["SQL round practice", 4, ["sql"]]]],
    ["Resume and LinkedIn reframe", [["Rewrite resume: QA wins as product outcomes", 4, ["communication"]], ["Update LinkedIn and ask 2 people for referrals", 4, ["stakeholders"]]]],
    ["Application sprint I", [["Apply to 5 roles with tailored notes", 5, ["communication"]], ["Follow up with referrals", 3, ["stakeholders"]]]],
    ["Application sprint II", [["Apply to 5 more roles", 5, ["communication"]], ["Review rejections and gaps, adjust plan", 3, ["ownership"]]]],
    ["Deepen the weakest skill", [["Targeted practice on your lowest-scoring skill", 5, ["research"]], ["Mock interview on that area", 3, ["communication"]]]],
    ["Case study polish", [["Turn the portfolio project into a 2-page case study", 5, ["communication", "specs"]], ["Get feedback from a working PM", 3, ["stakeholders"]]]],
    ["Interview loops", [["Full mock loop: behavioral, product sense, metrics", 5, ["communication", "metrics"]], ["Fix the top three feedback points", 3, ["problem"]]]],
    ["Negotiation and offers", [["Learn offer evaluation and APM compensation norms", 3, ["communication"]], ["Prepare questions for hiring managers", 5, ["stakeholders"]]]],
    ["Review and next steps", [["Review the six months: skills moved, gaps left", 3, ["ownership"]], ["Plan the next 90 days", 5, ["strategy"]]]],
  ],
  6,
);

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

const known = new Set(skills.map((s) => s.id));
for (const w of weeks) for (const t of w.tasks) t.skillIds = t.skillIds.filter((id) => known.has(id));

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
  skills,
  plan: {
    generatedAt: T,
    revision: 1,
    weeks,
    changelog: [
      { at: T, reason: "First plan", summary: "26 weeks at 8 hours a week, front-loaded on research, SQL and specs because those are your biggest gaps against the 8 JDs." },
    ],
  },
  projects: [
    {
      id: "p1",
      title: "Fix the UPI failed-payment experience",
      pitch: "Use your payments testing experience: research why users abandon after a failed UPI payment, and spec a better recovery flow.",
      skillIds: ["research", "specs", "metrics"],
      deliverable: "A 2-page case study with research notes, a PRD, and success metrics",
      scopeHours: 20,
      milestones: [
        { title: "Interview 5 UPI users", done: true },
        { title: "Write problem statement", done: false },
        { title: "Draft PRD", done: false },
        { title: "Review with an engineer", done: false },
      ],
      status: "active",
    },
    {
      id: "p2",
      title: "Funnel analysis of a public e-commerce dataset",
      pitch: "Answer product questions with SQL and write up what you would change.",
      skillIds: ["sql", "metrics"],
      deliverable: "A notebook plus a one-page recommendation memo",
      scopeHours: 12,
      milestones: [{ title: "Pick dataset", done: false }, { title: "Write 6 queries", done: false }, { title: "Recommendation memo", done: false }],
      status: "suggested",
    },
    {
      id: "p3",
      title: "Spec an AI test-case assistant",
      pitch: "Turn your QA know-how into an AI feature spec with evals and failure modes.",
      skillIds: ["ai", "specs", "engineering"],
      deliverable: "A PRD with an evaluation plan",
      scopeHours: 10,
      milestones: [{ title: "Define user and job", done: false }, { title: "Write PRD", done: false }, { title: "Eval plan", done: false }],
      status: "suggested",
    },
  ],
  interviews: [
    {
      id: "i1",
      kind: "behavioral",
      startedAt: T,
      turns: [
        {
          question: "Tell me about a time you pushed back on a decision.",
          answerTranscript: "On the portal migration the client wanted to skip regression to hit a date. I showed them the three payment defects regression had caught last release and proposed a smaller, risk-based suite instead.",
          feedback: "Good evidence and a real trade-off. Open with the outcome, and say what the client decided.",
          scores: { clarity: 4, structure: 3, evidence: 4 },
        },
      ],
      skillSignals: [{ skillId: "stakeholders", delta: 0.25 }],
    },
  ],
  checkins: [
    {
      id: "c1",
      weekN: 5,
      at: T,
      transcript: "Did the metrics reading and defined metrics for a checkout, but missed the SQL set because of a release crunch. About six hours this week.",
      parsed: {
        hoursSpent: 6,
        completedTaskIds: ["w5t1", "w5t2"],
        blockers: ["Release crunch at work"],
        mood: 3,
        wins: ["First clean metric tree"],
        notes: "Missed two hours; moved SQL practice into the next free weekend.",
      },
      planAdjustments: ["Moved 2h of SQL practice to week 7"],
    },
  ],
  applications: APPLICATIONS,
  settings: { wisprProInstalled: false, personaId: "arjun" },
};
