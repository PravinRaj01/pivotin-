// npm run check:links
// Re-checks every URL in data/resources.json over the network. A link passes if it answers 200 and does
// not redirect to a different page (a moved site or a generic index). Two W3C pages block scripts and
// are listed in MANUAL below after being opened by hand; they are still reported, not silently skipped.
import resources from "../data/resources.json";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MANUAL = new Set(["w3c-wai", "wcag-quickref"]); // 403 to scripts, confirmed real in a browser on 2026-10-31
const norm = (u: string) => new URL(u).pathname.replace(/\/+$/, "") + new URL(u).hostname.replace(/^www\./, "");

(async () => {
  let bad = 0;
  for (const r of resources) {
    try {
      const res = await fetch(r.url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(25000) });
      const moved = norm(res.url) !== norm(r.url);
      if (res.status === 200 && !moved) console.log("ok    ", r.id);
      else if (MANUAL.has(r.id) && res.status === 403) console.log("manual", r.id, "(blocks scripts)");
      else {
        bad++;
        console.log("FAIL  ", r.id, res.status, moved ? `moved to ${res.url}` : "");
      }
    } catch (e) {
      bad++;
      console.log("FAIL  ", r.id, (e as Error).message);
    }
  }
  console.log(bad ? `\n${bad} link(s) need fixing` : `\nall ${resources.length} links verified`);
  process.exit(bad ? 1 : 0);
})();
