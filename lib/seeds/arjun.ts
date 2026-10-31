import type { PivotProfile } from "../types";
import { makeSkills, makeWeeks, reqFromSkills } from "./build";

// Demo persona (fictional). Target JDs are the 8 in seeds/jds; the two in seeds/jds-demo-holdout
// are deliberately NOT here so they can be pasted live as unseen roles.

const T = "2026-10-31T09:00:00.000Z";

const jds = [
  ["j1", "Product Manager I", "Meesho", "Consumer e-commerce PM: own a charter end to end, work with engineering and design, drive metrics and experiments."],
  ["j2", "Product Analyst, Telco", "Paytm", "Analyse recharge and telco funnels with SQL, define metrics, partner with product and business teams."],
  ["j3", "Product Manager II, Travel", "Paytm", "Own travel product areas: roadmap, PRDs, A/B tests, launches, cross-functional delivery."],
  ["j4", "Product Manager, Product Platform", "Okta", "Enterprise SaaS platform PM: technical fluency, APIs, customer discovery, written specs."],
  ["j5", "Associate Product Manager", "Groww", "Fintech APM: user research, data-informed decisions, shipping features with engineering. (Source text partly cut off.)"],
  ["j6", "Associate Product Manager", "Swiggy", "Consumer startup APM: problem solving, ownership in ambiguity, metrics, collaboration with ops and tech."],
  ["j7", "Associate Product Manager", "Razorpay Curlec", "Payments APM based in Malaysia: stakeholder work, specs, experimentation, regional launch."],
  ["j8", "Associate Product Manager", "Urban Company", "Marketplace APM: short requirements list covering analytics, customer empathy and execution."],
].map(([id, title, company, gist]) => ({
  id,
  title,
  company,
  rawText: `${gist} (Gist only; full text lives in seeds/jds.)`,
  addedAt: T,
}));

const skills = makeSkills([
  ["stakeholders", "Stakeholder & cross-functional collaboration", "soft", 2.5, 4, ["Coordinated with developers, BAs and the client's UAT team on every release at work."]],
  ["research", "User / customer research & empathy", "craft", 1, 4, ["Sat in on two client demos, but has never run a user interview."]],
  ["communication", "Written & verbal communication", "soft", 3.5, 4, ["Writes clear bug reports and release notes; presents defect summaries to the client weekly."]],
  ["engineering", "Engineering / technical fluency", "technical", 4, 4, ["Four years testing APIs and web apps; reads logs, uses Postman, knows the release pipeline."]],
  ["sql", "SQL / data analysis", "technical", 2.5, 4, ["Writes SELECT and JOIN queries to verify test data; no analysis or dashboards yet."]],
  ["strategy", "Product strategy & roadmap", "craft", 0.5, 3, []],
  ["problem", "Problem solving / first principles", "soft", 3.5, 4, ["Root-caused a recurring payment-gateway defect that three teams had closed as 'cannot reproduce'."]],
  ["metrics", "Metrics / KPIs & business acumen", "domain", 1, 4, ["Tracks defect leakage and test coverage, but not product or business metrics."]],
  ["specs", "Specs, PRDs & user stories", "craft", 1.5, 4, ["Reads user stories daily to write test cases; has never authored one."]],
  ["experimentation", "Experimentation / A/B testing", "technical", 1, 3, ["Understands test design from QA; no exposure to statistical A/B tests."]],
  ["gtm", "Go-to-market & launch", "domain", 0.5, 2, []],
  ["ai", "AI / ML familiarity", "technical", 1, 2, ["Has used ChatGPT to draft test cases."]],
  ["prioritization", "Prioritization", "craft", 2.5, 3, ["Triages bugs by severity and release risk every sprint."]],
  ["ownership", "Ownership & ambiguity", "soft", 2.5, 3, ["Led UAT for a client portal migration with unclear requirements."]],
]);

const freq = {
  stakeholders: 1, research: 1, communication: 0.88, engineering: 0.88, sql: 0.75, strategy: 0.75,
  problem: 0.75, metrics: 0.75, specs: 0.63, experimentation: 0.63, gtm: 0.5, ai: 0.38,
  prioritization: 0.38, ownership: 0.38,
};

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
  },
  goal: {
    targetRole: "Associate Product Manager",
    targetIndustry: "Fintech or consumer tech",
    timelineWeeks: 26,
    hoursPerWeek: 8,
    motivation: "I keep finding the bugs that come from unclear requirements. I want to be the person who decides what gets built, not the one who finds out it was wrong at the end.",
    constraints: ["Full-time job, so evenings and weekends only", "Prefers to stay in Pune or work remote"],
  },
  story: {
    rawTranscripts: [
      {
        id: "t1",
        at: T,
        text: "So, uh, I'm Arjun, I've been a manual QA engineer for about four years at an IT services company here in Pune. Mostly banking and payments clients. I'm good at finding what breaks, but honestly the bugs I see most are not code bugs, they're requirement bugs. Somebody never asked the user what they wanted. I want to become an associate product manager in six months, and I can do maybe eight hours a week because of my job. I'm scared my background is too testing-heavy and that nobody will see me as a product person.",
      },
    ],
    summary: "Four years of manual QA on banking and payments projects in Pune. Strong at spotting what breaks and at working with developers; wants to move upstream to deciding what gets built.",
    strengths: ["Finds root causes others close as 'cannot reproduce'", "Clear written communication", "Knows how software ships"],
    fears: ["Background is too testing-heavy", "No product ownership on the resume", "Only 8 hours a week"],
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
  targetRole: { jds, requirements: reqFromSkills(skills, freq, jds.map((j) => j.id)) },
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
  applications: [
    { id: "a1", company: "Groww", role: "Associate Product Manager", jdId: "j5", status: "saved", dates: {}, notes: "Wait until the PRD and portfolio project are done.", followUps: [] },
    { id: "a2", company: "Swiggy", role: "Associate Product Manager", jdId: "j6", status: "saved", dates: {}, notes: "Ask a referral first.", followUps: ["Message the former colleague who moved to PM there"] },
    { id: "a3", company: "Meesho", role: "Product Manager I", jdId: "j1", status: "saved", dates: {}, notes: "Stretch role. Strong on engineering and ownership, weak on research and metrics.", followUps: [] },
  ],
  settings: { wisprProInstalled: false, personaId: "arjun" },
};
