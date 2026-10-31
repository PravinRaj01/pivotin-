// npm run test:tracker   (offline, no model calls)
// The tracker's rules: how speech becomes a row, what the statuses mean, how fit is worked out,
// and above all when a pattern may be claimed. Nothing is ever claimed from fewer than 5 applications.
import { fitFromRequirements, liveFit } from "../lib/fit";
import { arjun } from "../lib/seeds/arjun";
import type { ApplicationLogResult } from "../lib/schemas/agents";
import {
  MIN_GROUP, analyse, applyLog, canonChannel, canonResume, canonStatus, confidenceFor, engaged, fisherExact, funnel, insightKey, isoDate, sent, setStatus, shapeInsights, trackerInput,
} from "../lib/tracker";
import type { PivotProfile } from "../lib/types";

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}
const thrown = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const TODAY = "2026-11-01";
type App = PivotProfile["applications"][number];

console.log("\nSpeech into clean values");
check("'a referral' and 'through a friend' are both a Referral", canonChannel("a referral") === "Referral" && canonChannel("through a friend at the company") === "Referral");
check("careers page, job boards and recruiters are told apart", canonChannel("their careers page") === "Careers page" && canonChannel("LinkedIn") === "Job board" && canonChannel("Naukri") === "Job board" && canonChannel("a recruiter") === "Recruiter");
check("nothing said stays empty, something odd becomes Other", canonChannel("") === "" && canonChannel("a carrier pigeon") === "Other");
check("'version 2', 'v2' and 'my second resume' are all Version 2", ["version 2", "v2", "resume 2", "my second resume"].every((x) => canonResume(x) === "Version 2"), ["version 2", "v2", "resume 2", "my second resume"].map(canonResume));
check("a call with a recruiter being booked is a response", canonStatus("a recruiter called me to book a screening call") === "response");
check("heard back means response", canonStatus("heard back from them") === "response" && canonStatus("a recruiter called") === "response");
check("interview, offer and rejected", canonStatus("second round interview") === "interview" && canonStatus("they made me an offer") === "offer" && canonStatus("they turned me down") === "rejected");
check("saving a role is not applying", canonStatus("I want to apply next week") === "saved" && canonStatus("I applied") === "applied");
check("a date in the future is not allowed, nor is a bad one", isoDate("2027-01-01", TODAY) === TODAY && isoDate("yesterday", TODAY) === TODAY && isoDate("2026-10-31", TODAY) === "2026-10-31");

console.log("\nCounting");
const f = funnel(arjun.applications);
check("15 rows: 12 sent and 3 saved", f.sent === 12 && f.saved === 3, f);
check("a response, interview or offer counts as hearing back; a rejection on its own does not", f.engaged === f.response + f.interview + f.offer && f.engaged === 6, f.engaged);
check("saved roles are not applications", sent(arjun.applications).every((a) => a.status !== "saved"));
check("engaged() agrees with the funnel", arjun.applications.filter(engaged).length === f.engaged);

console.log("\nHow unlikely is luck (Fisher's exact test)");
check("4 of 4 against 0 of 4 is p = 2/70", Math.abs(fisherExact(4, 4, 0, 4) - 2 / 70) < 1e-9, fisherExact(4, 4, 0, 4));
check("the same rate in both groups is p = 1", Math.abs(fisherExact(3, 6, 3, 6) - 1) < 1e-9);
check("it does not matter which group is listed first", Math.abs(fisherExact(5, 5, 1, 7) - fisherExact(1, 7, 5, 5)) < 1e-12);
check("5 of 5 against 1 of 7 is about 0.015", Math.abs(fisherExact(5, 5, 1, 7) - 0.0152) < 0.001, fisherExact(5, 5, 1, 7));

console.log("\nHow sure: the label always carries the count");
check("under 5 applications there is nothing to claim", [0, 1, 4].every((n) => confidenceFor(n).tier === "none"));
check("the label names the count", confidenceFor(6).label === "Early signal, 6 applications" && confidenceFor(12).label === "Early signal, 12 applications", [confidenceFor(6).label, confidenceFor(12).label]);
check("tiers rise with the count", confidenceFor(14).tier === "early" && confidenceFor(15).tier === "emerging" && confidenceFor(29).tier === "emerging" && confidenceFor(30).tier === "established");

// A small profile with exactly the applications we choose: [channel, status]
const make = (rows: [string, App["status"]][]): PivotProfile => ({
  ...arjun,
  applications: rows.map(([channel, status], i) => ({ ...arjun.applications[0], id: `t${i}`, company: `Co${i}`, role: "Role", channel, status, roleFamily: "Fam", companyStage: "Late stage", industry: "Fintech", resumeVersion: "Version 1", dates: {}, inferred: [], jdId: undefined, fitBasis: undefined, fitScore: undefined })),
});
const rep = (n: number, ch: string, st: App["status"]): [string, App["status"]][] => Array.from({ length: n }, () => [ch, st]);

console.log("\nNever a claim from fewer than 5 applications");
for (const total of [1, 2, 3, 4]) {
  const pr = make(rep(total, "Referral", "interview"));
  check(`${total} application${total > 1 ? "s" : ""}, all got interviews: no pattern, nothing claimed`, analyse(pr).patterns.length === 0 && analyse(pr).confidence.tier === "none");
}
check("5 to 9 applications: even a perfect split is not enough, each side needs 5", analyse(make([...rep(5, "Referral", "interview"), ...rep(4, "Careers page", "rejected")])).patterns.length === 0);
check("10 applications split 5 and 5, with a perfect difference: now it is a pattern", (() => { const a = analyse(make([...rep(5, "Referral", "interview"), ...rep(5, "Careers page", "rejected")])); return a.patterns.length === 1 && a.patterns[0].value === "Referral" && a.patterns[0].n === 5 && a.patterns[0].restN === 5; })());
check("and it is called an early signal with the count", analyse(make([...rep(5, "Referral", "interview"), ...rep(5, "Careers page", "rejected")])).confidence.label === "Early signal, 10 applications");
check("a group of 4 is never claimed, however well it did", (() => { const a = analyse(make([...rep(4, "Referral", "interview"), ...rep(8, "Careers page", "rejected")])); return a.patterns.length === 0 && a.tooSmall.some((x) => x.value === "Referral" && x.n === 4); })());
check("a group that is much bigger than 5 is judged against 5 or more others", (() => { const a = analyse(make([...rep(8, "Referral", "interview"), ...rep(3, "Careers page", "rejected")])); return a.patterns.length === 0; })());
check("a small difference is not a pattern even with plenty of data", analyse(make([...rep(10, "Referral", "interview"), ...rep(10, "Referral", "applied"), ...rep(10, "Careers page", "interview"), ...rep(8, "Careers page", "applied")])).patterns.length === 0);
check("a difference that could easily be luck is not a pattern", analyse(make([...rep(3, "Referral", "interview"), ...rep(2, "Referral", "applied"), ...rep(1, "Careers page", "interview"), ...rep(4, "Careers page", "applied")])).patterns.length === 0);
check("every pattern ever returned has at least 5 on each side", (() => { const a = analyse(arjun); return a.patterns.every((p) => p.n >= MIN_GROUP && p.restN >= MIN_GROUP); })());
check("a group that does clearly worse is found, and marked lower", analyse(make([...rep(5, "Referral", "rejected"), ...rep(5, "Careers page", "interview"), ...rep(5, "Job board", "interview")])).patterns.some((p) => p.value === "Referral" && p.direction === "lower"));
check("two groups that mirror each other are reported once, as the one doing better", (() => { const a = analyse(make([...rep(5, "Referral", "interview"), ...rep(5, "Careers page", "rejected")])); return a.patterns.length === 1 && a.patterns[0].direction === "higher"; })());

console.log("\nThe demo data");
const an = analyse(arjun);
check("12 applications sent: an early signal", an.total === 12 && an.confidence.label === "Early signal, 12 applications", an.confidence.label);
check("exactly one pattern: referrals", an.patterns.length === 1 && an.patterns[0].id === "channel:Referral", an.patterns.map((p) => p.id));
check("referrals: 5 of 5 heard back, everything else 1 of 7", an.patterns[0].engaged === 5 && an.patterns[0].n === 5 && an.patterns[0].restEngaged === 1 && an.patterns[0].restN === 7, an.patterns[0]);
check("role family, stage, industry and resume version show no claim", !an.patterns.some((p) => ["roleFamily", "companyStage", "industry", "resumeVersion"].includes(p.dimension)));
check("groups too small to compare are listed as too small, not hidden", an.tooSmall.some((x) => x.value === "Careers page" && x.n === 4) && an.tooSmall.some((x) => x.value === "Job board" && x.n === 3));
check("the number of comparisons checked is reported", an.comparisons >= 5, an.comparisons);
check("the same data gives the same key, a new outcome changes it", insightKey(an) === insightKey(analyse(arjun)) && insightKey(an) !== insightKey(analyse(setStatus(arjun, "a12", "interview", TODAY))));

console.log("\nLogging by voice");
const row = (over: Partial<ApplicationLogResult>): ApplicationLogResult => ({ action: "add", company: "", role: "", roleFamily: "", companyStage: "", industry: "", channel: "", resumeVersion: "", status: "", appliedOn: "", location: "", notes: "", inferred: [], ...over });
const swiggy = applyLog(arjun, row({ action: "update", company: "Swiggy", status: "applied", channel: "through a referral", resumeVersion: "version 2", appliedOn: "2026-10-31" }), TODAY);
check("applying to a saved role updates that row instead of adding a second one", swiggy.mode === "updated" && swiggy.profile.applications.length === 15, swiggy.profile.applications.length);
check("it becomes Applied with the channel and resume, on the day said", swiggy.row.status === "applied" && swiggy.row.channel === "Referral" && swiggy.row.resumeVersion === "Version 2" && swiggy.row.dates.applied === "2026-10-31", swiggy.row);
check("what was already known is kept", swiggy.row.role.startsWith("Associate Product Manager") && swiggy.row.jdId === "j6" && swiggy.row.notes.includes("Referral first"));
const afterSwiggy = analyse(swiggy.profile);
check("the new application counts toward the pattern: referrals now 5 of 6", afterSwiggy.total === 13 && afterSwiggy.patterns[0]?.id === "channel:Referral" && afterSwiggy.patterns[0].n === 6 && afterSwiggy.patterns[0].engaged === 5, afterSwiggy.patterns[0]);
const added = applyLog(arjun, row({ company: "Lenskart", role: "Associate Product Manager", roleFamily: "associate product manager", companyStage: "Late stage", industry: "Retail", channel: "LinkedIn", resumeVersion: "v1", status: "applied", appliedOn: "2026-10-30", inferred: ["companyStage", "industry"] }), TODAY, "new1");
check("a new company is added as a 16th row, logged by voice", added.mode === "added" && added.profile.applications.length === 16 && added.row.source === "Logged by voice");
check("the role family reuses the existing wording exactly", added.row.roleFamily === "Associate product manager", added.row.roleFamily);
check("channel and resume are cleaned", added.row.channel === "Job board" && added.row.resumeVersion === "Version 1");
check("fields filled from general knowledge are marked as guesses", added.row.inferred.join() === "companyStage,industry");
check("a saved role has no applied date", applyLog(arjun, row({ company: "Nykaa", role: "Associate Product Manager", status: "saved" }), TODAY).row.dates.applied === undefined);
check("no status said means applied", applyLog(arjun, row({ company: "Nykaa", role: "Associate Product Manager" }), TODAY).row.status === "applied");
check("a missing company is an error", thrown(() => applyLog(arjun, row({ role: "x" }), TODAY)));
check("a new company with no role is an error", thrown(() => applyLog(arjun, row({ company: "Nykaa" }), TODAY)));
check("news about a company that is not there is an error", thrown(() => applyLog(arjun, row({ action: "update", company: "Nykaa", status: "response" }), TODAY)));
const twice = applyLog(arjun, row({ company: "Zomato", role: "Associate Product Manager", status: "interview" }), TODAY);
check("saying a company that is already there with the same role updates it, never duplicates", twice.mode === "updated" && twice.profile.applications.filter((a) => a.company === "Zomato").length === 1 && twice.row.status === "interview");
const two = applyLog({ ...arjun, applications: [...arjun.applications, { ...arjun.applications[0], id: "z2", role: "Product Analyst" }] }, row({ company: "Zomato", role: "Product Analyst", status: "rejected" }), TODAY);
check("with two roles at one company, the role picks the right one", two.row.id === "z2" && two.row.status === "rejected");
check("an ambiguous company with no role is refused with the roles listed", thrown(() => applyLog({ ...arjun, applications: [...arjun.applications, { ...arjun.applications[0], id: "z2", role: "Product Analyst" }] }, row({ action: "update", company: "Zomato", status: "rejected" }), TODAY)));
check("news only changes the status and leaves the rest alone", (() => { const u = applyLog(arjun, row({ action: "update", company: "CRED", status: "interview" }), TODAY); const was = arjun.applications.find((a) => a.company === "CRED")!; return u.row.status === "interview" && u.row.channel === was.channel && u.row.resumeVersion === was.resumeVersion && u.row.roleFamily === was.roleFamily; })());
check("a note on an update is added to the old one", applyLog(arjun, row({ action: "update", company: "CRED", notes: "Panel on Friday." }), TODAY).row.notes.endsWith("Panel on Friday.") && applyLog(arjun, row({ action: "update", company: "CRED", notes: "Panel on Friday." }), TODAY).row.notes.includes("referral"));
check("the agent's input lists what is already in the tracker, to avoid duplicates", trackerInput(arjun, "x", TODAY).existing.applications.length === 15 && trackerInput(arjun, "x", TODAY).existing.roleFamilies.length === 3);

console.log("\nFit comes from the bridge map");
const paytm = arjun.applications.find((a) => a.company === "Paytm")!;
const fit = liveFit(arjun, paytm);
check("an application linked to a job description is scored on that description's skills", fit.basis === "job description" && fit.score >= 0 && fit.score <= 100, fit);
check("one with no description uses the overall map and says so", liveFit(arjun, arjun.applications.find((a) => a.company === "CRED")!).basis === "overall map");
const better = { ...arjun, skills: arjun.skills.map((s) => ({ ...s, current: Math.min(3, s.current + 1) })) };
check("stronger skills raise the fit", liveFit(better, paytm).score > fit.score, [fit.score, liveFit(better, paytm).score]);
check("weaker skills lower it", liveFit({ ...arjun, skills: arjun.skills.map((s) => ({ ...s, current: 0 })) }, paytm).score === 0);
check("a requirement the map does not know counts as a skill not yet had", (() => { const base = fitFromRequirements(arjun, [{ label: "Written & verbal communication", importance: 4 }])!; const withUnknown = fitFromRequirements(arjun, [{ label: "Written & verbal communication", importance: 4 }, { label: "Underwater welding", importance: 5 }])!; return withUnknown < base; })());
check("an empty list of requirements gives no score, not a made-up one", fitFromRequirements(arjun, []) === null);
check("a pasted job description keeps the score it was given", liveFit(arjun, { ...paytm, jdId: undefined, fitBasis: "job description", fitScore: 71 }).score === 71);

console.log("\nWhat the analyst may say");
const A = analyse(arjun);
const pid = A.patterns[0].id;
const good = shapeInsights(arjun, A, { headline: "Early signal, 12 applications: referrals get replies.", findings: [{ patternId: pid, text: "5 of 5 referral applications heard back, against 1 of 7 for everything else." }], suggestions: [{ kind: "plan", text: "Spend a week asking for introductions.", patternId: pid }], caveat: "Small numbers." }, "2026-11-01T00:00:00Z");
check("a finding that matches a pattern and uses its exact numbers is kept", good.findings.length === 1 && good.suggestions.length === 1);
check("a finding about a pattern that does not exist is dropped", thrown(() => shapeInsights(arjun, A, { headline: "", findings: [{ patternId: "channel:Careers page", text: "0 of 4 heard back." }], suggestions: [], caveat: "" }, "x")));
check("a finding with an invented number is dropped", thrown(() => shapeInsights(arjun, A, { headline: "", findings: [{ patternId: pid, text: "9 of 9 referral applications heard back." }], suggestions: [], caveat: "" }, "x")));
check("a suggested target role that is not in the data is dropped", shapeInsights(arjun, A, { headline: "h", findings: [{ patternId: pid, text: "5 of 5 heard back." }], suggestions: [{ kind: "target-role", text: "Aim at astronaut roles.", role: "Astronaut", patternId: pid }, { kind: "target-role", text: "Also aim at product analyst roles.", role: "Product analyst", patternId: pid }], caveat: "" }, "x").suggestions.map((s) => s.role).join() === "Product analyst");
check("a suggestion tied to no real pattern is dropped", shapeInsights(arjun, A, { headline: "h", findings: [{ patternId: pid, text: "5 of 5 heard back." }], suggestions: [{ kind: "plan", text: "Do something.", patternId: "nope" }], caveat: "" }, "x").suggestions.length === 0);
check("at most 3 suggestions are kept", shapeInsights(arjun, A, { headline: "h", findings: [{ patternId: pid, text: "5 of 5 heard back." }], suggestions: Array.from({ length: 6 }, () => ({ kind: "plan" as const, text: "step", patternId: pid })), caveat: "" }, "x").suggestions.length === 3);
check("the headline falls back to the confidence label", shapeInsights(arjun, A, { headline: "", findings: [{ patternId: pid, text: "5 of 5 heard back." }], suggestions: [], caveat: "" }, "x").headline === "Early signal, 12 applications");

console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall tracker tests passed");
process.exit(fails.length ? 1 : 0);
