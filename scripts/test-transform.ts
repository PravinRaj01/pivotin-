// npm run test:transform   (offline)
// The optional transform: how its output is recognised, that the examples on the page are valid output of the prompt,
// and that interview answers ignore it. Part 2 (live, 3 requests) checks the agents read sorted text as well as plain text.
import { join } from "node:path";
import { stripTransformTags, verifyQuote } from "../lib/interview";
import { EXAMPLES, LABELS, TRANSFORM_PROMPT, isTransformed, transformType, withoutHeader } from "../lib/transform";

const fails: string[] = [];
function check(name: string, pass: boolean, got?: unknown) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass ? "" : `   (got ${JSON.stringify(got)})`}`);
  if (!pass) fails.push(name);
}

console.log("\nThe prompt");
check("it is the prompt as given: all 7 steps and the header format", [/^You tidy dictated text for Pivotin'/, /1\. Detect the type/, /2\. If the type is INTERVIEW/, /3\. Otherwise, resolve/, /4\. Output a first line "#pivotin v1 - <type>"/, /5\. Keep tangents/, /6\. Add a "Corrections:" line/, /7\. Leave a field out/].every((r) => r.test(TRANSFORM_PROMPT)));
check("every label in the prompt is in the list the page validates against", Object.values(LABELS).flat().every((l) => TRANSFORM_PROMPT.includes(l)));
check("it says to return interview answers unchanged but for the first line", /exactly as given, with only "#pivotin v1 - interview" added as the first line/.test(TRANSFORM_PROMPT));

console.log("\nRecognising sorted text");
check("the header line is recognised for every type", ["intro", "checkin", "application", "interview"].every((t) => isTransformed(`#pivotin v1 - ${t}\nSomething`)));
check("uppercase types and spaces before the line are fine", isTransformed("  #pivotin v1 - INTRO\nx") && isTransformed("#PIVOTIN V1 - checkin\nx"));
check("'#pivotin b1' (how a dictation tool might hear v1) is accepted too", isTransformed("#pivotin b1\nx") && isTransformed("#pivotin b1 - intro\nx"));
check("plain text is not sorted text", !isTransformed("I am Arjun and I test software") && !isTransformed("") && !isTransformed("pivotin v1 - intro"));
check("only the FIRST line counts", !isTransformed("Hello\n#pivotin v1 - intro\nx"));
check("a space after the # is not the header", !isTransformed("# pivotin v1 - intro"));
check("the type is read from the header", transformType("#pivotin v1 - check-in\nx") === "checkin" && transformType("#pivotin v1 - INTERVIEW\nx") === "interview" && transformType("plain") === null && transformType("#pivotin v1\nx") === null);
check("the header can be removed, leaving the rest as it was", withoutHeader("#pivotin v1 - intro\nRoles: QA\nTools: SQL") === "Roles: QA\nTools: SQL" && withoutHeader("no header\nhere") === "no header\nhere");

console.log("\nThe examples on the page are valid output of the prompt");
for (const e of EXAMPLES) {
  const lines = e.after.split("\n");
  const labels = lines.slice(1).map((l) => l.split(":")[0]);
  const allowed = new Set<string>([...LABELS[e.key], "Corrections"]);
  check(`${e.key}: starts with the header for its own type`, isTransformed(e.after) && transformType(e.after) === e.key, lines[0]);
  check(`${e.key}: every line uses a label the prompt allows for this type`, labels.every((l) => allowed.has(l)), labels.filter((l) => !allowed.has(l)));
  check(`${e.key}: a self-correction in the text is listed under Corrections`, /self-correction|no wait|no,|I mean/i.test(e.before) ? lines.some((l) => l.startsWith("Corrections:")) : true);
  const words: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 12: "twelve" };
  const nums = lines.slice(1).filter((l) => !l.startsWith("Corrections:")).flatMap((l) => l.match(/\d+/g) ?? []).map(Number);
  check(`${e.key}: every number in the sorted text comes from what was dictated`, nums.every((n) => new RegExp(`\\b${n}\\b|\\b${words[n] ?? "@@"}\\b`, "i").test(e.before)), nums);
  check(`${e.key}: a remark is kept under Aside, not dropped`, /aside/i.test(e.after));
  check(`${e.key}: an unmentioned field is left out, not filled in`, e.key !== "application" || !lines.some((l) => l.startsWith("Role:")));
}

console.log("\nInterview answers ignore the transform");
const raw = "I would compare effort and impact. [GOAL] Then I would check the result.";
check("the header line is removed before scoring", stripTransformTags("#pivotin v1 - interview\nI would compare effort and impact.") === "I would compare effort and impact.");
check("the answer is otherwise exactly as spoken", stripTransformTags("#pivotin v1 - interview\n" + raw) === "I would compare effort and impact.  Then I would check the result.".replace("  ", " "), stripTransformTags("#pivotin v1 - interview\n" + raw));
check("a transform that sorted it anyway cannot change the score: only the answer's words are left", !/pivotin|interview\n/.test(stripTransformTags("#pivotin v1 - interview\nMy answer.")));
check("a quote from the answer still verifies against the cleaned text", verifyQuote(stripTransformTags("#pivotin v1 - interview\nI would compare effort and impact."), "compare effort and impact"));
check("an answer with no header is unchanged", stripTransformTags("Just an answer.") === "Just an answer.");

if (!process.env.LIVE && !process.argv.includes("--live")) {
  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall transform tests passed (run test:transform-live for the live part)");
  process.exit(fails.length ? 1 : 0);
}

// ---------- live ----------
process.loadEnvFile(join(__dirname, "..", ".env.local"));
(async () => {
  console.log("\nLive: the same story, plain and sorted, gives the same facts");
  const post = async (route: string, body: unknown) => {
    const mod = await import(`../app/api/${route}/route`);
    const res = await mod.POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    if (!res.ok) throw new Error(`${route} ${res.status} ${await res.text()}`);
    return res.json();
  };
  const intro = EXAMPLES[0];
  const plain = await post("intake", { transcript: intro.before, today: "2026-10-31" });
  const sorted = await post("intake", { transcript: intro.after, today: "2026-10-31" });
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  console.log(`   plain : ${plain.person.currentRole} | ${plain.person.yearsExperience}y | ${plain.goal.targetRole} | ${plain.goal.hoursPerWeek}h | ${plain.goal.deadline} | ${JSON.stringify(plain.goal.salaryFloor)} | prefs ${plain.preferences.map((p: { text: string }) => p.text).join("; ")}`);
  console.log(`   sorted: ${sorted.person.currentRole} | ${sorted.person.yearsExperience}y | ${sorted.goal.targetRole} | ${sorted.goal.hoursPerWeek}h | ${sorted.goal.deadline} | ${JSON.stringify(sorted.goal.salaryFloor)} | prefs ${sorted.preferences.map((p: { text: string }) => p.text).join("; ")}`);
  check("sorted text gives the same years, hours and pay floor", sorted.person.yearsExperience === 4 && sorted.goal.hoursPerWeek === 8 && sorted.goal.salaryFloor?.amount === plain.goal.salaryFloor?.amount, [sorted.person.yearsExperience, sorted.goal.hoursPerWeek, sorted.goal.salaryFloor]);
  check("and the same target role and city", /associate product manager/i.test(sorted.goal.targetRole) && /pune/i.test(sorted.person.location));
  check("the Aside line still becomes a preference (the dislike is kept)", sorted.preferences.some((p: { kind: string; text: string }) => p.kind === "dislike" && /regression/i.test(p.text)), sorted.preferences);
  check("the Corrections line is not read as a second set of facts (years stay 4)", sorted.person.yearsExperience === 4 && !same(sorted.corrections.length, 99));
  check("a deadline is still worked out from 'end of April'", /2027-04-30/.test(sorted.goal.deadline), sorted.goal.deadline);

  const app = EXAMPLES[2];
  const row = await post("application", { utterance: app.after, today: "2026-11-01", targetRole: "Associate Product Manager", existing: { roleFamilies: [], companyStages: [], industries: [], resumeVersions: [], applications: [] } });
  console.log(`   application: ${JSON.stringify({ company: row.company, role: row.role, channel: row.channel, resume: row.resumeVersion, status: row.status, appliedOn: row.appliedOn })}`);
  check("a sorted application note is read: Zomato, referral, Version 2, applied", /zomato/i.test(row.company) && /referr/i.test(row.channel) && /2/.test(row.resumeVersion) && row.status === "applied", row);
  check("the role was never mentioned, so none is invented", row.role === "" || /^\s*$/.test(row.role), row.role);
  check("the date 'Yesterday' is turned into the day before today", row.appliedOn === "2026-10-31", row.appliedOn);

  console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join("\n- ")}` : "\nall transform tests passed");
  process.exit(fails.length ? 1 : 0);
})();
