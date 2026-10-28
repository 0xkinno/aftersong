// Reachability check after every deploy: requests every public path and fails on any non-200.
// Usage: node scripts/deploy-check.mjs <web-url> [backend-url]
const web = (process.argv[2] ?? "").replace(/\/$/, "");
const backend = (process.argv[3] ?? "").replace(/\/$/, "");
if (!web) {
  console.error("Usage: node scripts/deploy-check.mjs <web-url> [backend-url]");
  process.exit(2);
}
const paths = ["/", "/judge", "/method", "/sample", "/evidence", "/compare", "/group", "/trace", "/api/status", "/api/stats", "/api/sample/residents"];
let bad = 0;
const hit = async (url) => {
  const t = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    const ok = res.status === 200;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${res.status} ${Date.now() - t}ms ${url}`);
  } catch (e) {
    bad++;
    console.log(`FAIL --- ${url} ${e.name}`);
  }
};
for (const p of paths) await hit(web + p);
if (backend) await hit(backend + "/health");
console.log(bad ? `${bad} path(s) failed.` : "All public paths answered 200.");
process.exit(bad ? 1 : 0);
