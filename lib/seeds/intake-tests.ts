// Three messy, made-up intake transcripts from three different careers and countries.
// Wispr Flow has already removed filler words, so what is left is tangents, corrections that
// span several sentences, and side comments. Used by `npm run test:intake`.

export const INTAKE_TODAY = "2026-10-31";

export type IntakeCase = { id: string; label: string; transcript: string };

export const INTAKE_CASES: IntakeCase[] = [
  {
    id: "warehouse",
    label: "Warehouse supervisor, Johannesburg, to demand planning (everything stated)",
    transcript: `My name is Thandi Mokoena and I run the night shift. Actually let me start properly. I'm a warehouse supervisor at a distribution centre in Johannesburg, out near Isando. I've been in warehousing for eleven years. No, sorry, twelve, I started in January 2014 as a picker. I manage a team of thirty and we ship about four thousand orders a shift. Last year I got our mis-pick rate from three percent to under one percent by building a re-slotting plan in Excel. We use SAP for stock and handheld scanners on the floor. My son plays under-twelve football every Saturday and last weekend the coach decided to change the whole formation, which, whatever, anyway. What I really want is to move into supply chain planning, like a demand planner. I like the numbers part and the forecasting. I really hated the night shifts and all the paperwork for incident reports, that part drains me. I'd like to do it within ten months. No, let me say by the end of August next year, because my lease ends then. I can give maybe ten hours a week. Hmm, no, weekends are family time, so it's six hours on weekday evenings. On money, I earn eighteen thousand rand a month now. No wait, twenty-two after the raise in October, but I need at least thirty thousand a month in the new job. I'd work in Johannesburg or Pretoria, remote is fine too. I'm scared because I don't have a degree, only a national certificate.`,
  },
  {
    id: "chef",
    label: "Sous chef, Toronto, target role unknown (needs role suggestions)",
    transcript: `I'm Marco. I've been a line cook and then a sous chef in Toronto for nine years. Well, eight and a half if you take out the year I spent in Montreal. Right now I'm sous chef at a hotel restaurant downtown. I run the pass and write the weekly orders. I cut our food cost from thirty-four to twenty-nine percent by switching two suppliers and tracking waste on a spreadsheet every night. Honestly I'm burnt out from the late nights and the weekends, and my knees are done. My brother thinks I should become a developer. I tried a coding bootcamp thing in 2019 and I hated sitting that long, so skip that. I don't really know what I want to do. Something in food tech or operations, or maybe training people? I like organising systems and teaching the new kids. I don't like fighting with the front of house about orders. I can do about twelve hours a week because I'm on split shifts. I want to be out of the kitchen within a year, roughly. I need at least seventy thousand Canadian a year to cover rent. Toronto only, I can't move because of my daughter's school.`,
  },
  {
    id: "civil",
    label: "Site engineer, Chennai, to urban planning / GIS (hours never mentioned)",
    transcript: `Hi, this is Karthik. I'm a site engineer, civil, at a construction contractor in Chennai. Five years, no, six years if I count my internship. I supervise the concrete work, measure quantities and prepare the bar bending schedules. I've used AutoCAD and Primavera, and I wrote some Excel macros to track pour quantities which saved the project manager about a day every week. Last month there was a crazy storm and the whole site flooded, anyway, that's not important. I want to move into urban planning or GIS, something with maps and data. I loved the mapping part of my college project and I hate being out on site in the heat. I wanted to do this in about twelve months. No, my wife and I are expecting in the summer, so let's say eight months. My current pay is six lakh a year, and I'd need at least nine lakh. Chennai or Bengaluru, or remote is okay. I'm worried that planning jobs want a master's degree.`,
  },
];
