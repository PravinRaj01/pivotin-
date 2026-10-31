import type { PivotProfile } from "../types";
import { makeSkills, makeWeeks, reqFromSkills } from "./build";

// Preloaded fallback for the live "teacher to UX designer" run, used if the free LLM API is down.
// Deliberately outside India, to show the engine is not tied to one market.

const T = "2026-10-31T09:00:00.000Z";

const jds = [
  {
    id: "j1",
    title: "Junior UX Designer",
    company: "Northlight Digital (fictional agency)",
    rawText: "Junior UX designer for a Leeds agency: run user research, build wireframes and prototypes in Figma, present to clients, work with developers. (Gist only.)",
    addedAt: T,
  },
];

const skills = makeSkills([
  ["research", "User research & interviewing", "craft", 2, 3, ["Interviews pupils and parents weekly; reads classroom behaviour closely."]],
  ["communication", "Presenting & explaining ideas", "soft", 3, 3, ["Teaches 30 pupils at a time and explains hard ideas simply."]],
  ["wireframing", "Wireframing & prototyping", "craft", 0, 3, []],
  ["figma", "Figma / design tools", "technical", 0, 3, []],
  ["ia", "Information architecture & flows", "craft", 1, 2, ["Redesigned the department's scheme-of-work structure so staff could find lessons faster."]],
  ["accessibility", "Accessibility & inclusive design", "domain", 2, 2, ["Adapts materials for pupils with SEN every week."]],
  ["testing", "Usability testing", "craft", 1, 2, ["Informally trialled new worksheets with a small class group."]],
  ["collab", "Working with developers & stakeholders", "soft", 1, 2, ["Coordinates with the SENCo, parents and senior leadership."]],
  ["portfolio", "Portfolio & case studies", "craft", 0, 3, []],
]);

const weeks = makeWeeks(
  [
    ["What UX designers actually do", [["Read 3 junior UX JDs and list the repeating skills", 3, ["research"]], ["Map teaching skills to UX skills", 3, ["communication"]], ["Figma basics: frames, text, components", 4, ["figma"]]]],
    ["Figma fundamentals", [["Recreate a simple app screen in Figma", 6, ["figma", "wireframing"]], ["Learn auto-layout", 4, ["figma"]]]],
    ["Research methods", [["Learn interview, survey and diary-study methods", 4, ["research"]], ["Plan research for your first project", 6, ["research"]]]],
    ["Project 1: research", [["Interview 5 users about a school-parent communication app", 7, ["research"]], ["Synthesise into themes", 3, ["research"]]]],
    ["Project 1: flows", [["Map the user journey", 4, ["ia"]], ["Sketch three flow options", 6, ["ia", "wireframing"]]]],
    ["Project 1: wireframes", [["Low-fidelity wireframes in Figma", 6, ["wireframing", "figma"]], ["Review against accessibility checklist", 4, ["accessibility"]]]],
    ["Project 1: prototype", [["Build a clickable prototype", 6, ["figma"]], ["Plan a usability test", 4, ["testing"]]]],
    ["Project 1: test and iterate", [["Run 5 usability tests", 6, ["testing"]], ["Fix the top 3 issues", 4, ["wireframing"]]]],
    ["Case study writing", [["Write the case study: problem, process, outcome", 7, ["portfolio", "communication"]], ["Get feedback from a working designer", 3, ["collab"]]]],
    ["Portfolio site", [["Publish a one-page portfolio", 6, ["portfolio"]], ["Add a second small project idea", 4, ["portfolio"]]]],
    ["Working with developers", [["Learn handoff basics and design specs", 5, ["collab"]], ["Mock handoff with a developer friend", 5, ["collab"]]]],
    ["Applications and interviews", [["Tailor CV: teaching wins as UX outcomes", 5, ["communication"]], ["Mock portfolio presentation", 5, ["communication"]]]],
  ],
  0,
);

export const teacher: PivotProfile = {
  version: 1,
  id: "persona-teacher",
  createdAt: T,
  updatedAt: T,
  person: {
    name: "Hannah",
    location: "Leeds, UK",
    yearsExperience: 6,
    currentRole: "Secondary school science teacher",
    currentIndustry: "Education",
    education: "BSc Biology, PGCE",
  },
  goal: {
    targetRole: "UX Designer",
    targetIndustry: "Agency or product company",
    timelineWeeks: 12,
    hoursPerWeek: 10,
    deadline: "2027-01-31",
    salaryFloor: { amount: 32000, currency: "GBP", period: "year" },
    cities: ["Leeds", "Remote"],
    alternateRoles: ["UX Researcher"],
    motivation: "I love designing lessons that work for every pupil, and I want to design digital things people find easy to use.",
    constraints: ["Teaching full time", "Can study evenings and Sundays", "Wants to stay in Yorkshire or work remote"],
  },
  story: {
    rawTranscripts: [
      {
        id: "t1",
        at: T,
        text: "I'm Hannah, I teach science at a secondary school in Leeds, six years now. I'm burnt out on the marking and the politics but I love working out why a lesson didn't land for a pupil and redesigning it. I want to move into UX design. I've never opened Figma. I've got about ten hours a week, and I'd like to be applying in three months.",
      },
    ],
    summary: "Six years teaching science, strong at understanding learners and explaining things; wants to apply that to UX design with no design-tool experience yet.",
    strengths: ["Empathy and observation", "Explaining complex ideas simply", "Inclusive design for different needs"],
    fears: ["No design portfolio", "Never used Figma", "Looking too junior after six years of seniority"],
  },
  experience: [
    {
      id: "e1",
      role: "Science Teacher",
      org: "A secondary school in Leeds",
      period: "2020 - present",
      achievements: [
        "Redesigned the Year 9 scheme of work after pupil feedback, raising assessment scores",
        "Adapted materials for pupils with special educational needs",
      ],
      toolsUsed: ["Google Classroom", "PowerPoint", "Excel"],
    },
  ],
  targetRole: { jds, requirements: reqFromSkills(skills, { research: 1, communication: 0.9, wireframing: 1, figma: 1, ia: 0.7, accessibility: 0.6, testing: 0.8, collab: 0.8, portfolio: 1 }, ["j1"]) },
  skills,
  plan: {
    generatedAt: T,
    revision: 1,
    weeks,
    changelog: [{ at: T, reason: "First plan", summary: "12 weeks at 10 hours a week, built around one portfolio project with research, prototype and testing." }],
  },
  projects: [
    {
      id: "p1",
      title: "Redesign a school-parent communication app",
      pitch: "You know the problem first-hand. Research it, then design and test a better flow.",
      skillIds: ["research", "wireframing", "testing", "portfolio"],
      deliverable: "A case study with research, wireframes, a prototype and test results",
      scopeHours: 40,
      milestones: [
        { title: "Interview 5 parents and teachers", done: false },
        { title: "Wireframes", done: false },
        { title: "Prototype", done: false },
        { title: "Usability test", done: false },
      ],
      status: "suggested",
    },
  ],
  interviews: [],
  checkins: [],
  applications: [],
  settings: { wisprProInstalled: false, personaId: "teacher" },
};
