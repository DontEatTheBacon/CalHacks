// End-to-end check of WP1 against the Convex deployment in .env.local: real Convex Auth sign-up,
// round robin, messages, upload, authenticated download and CORS. Creates fictional accounts only.
// Usage: node scripts/e2e-wp1.mjs   (needs `npx convex dev` running and auth keys set)
import { ConvexHttpClient } from "convex/browser";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const env = Object.fromEntries(readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).split(" #")[0].trim()]));
const { CONVEX_URL, CONVEX_SITE_URL } = env;
const run = Date.now();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; };

async function signUp(email, name) {
  const anon = new ConvexHttpClient(CONVEX_URL);
  // The client tries to make itself a counselor; the server must ignore it.
  const r = await anon.action("auth:signIn", { provider: "password", params: { email, password: "fictional-pass-123", name, flow: "signUp", role: "counselor" } });
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(r.tokens.token);
  return { client, token: r.tokens.token, email };
}
const convexRun = (fn, args) => execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString();

const nadia = await signUp(`nadia+${run}@demo.test`, "Nadia (fictional)");
ok((await nadia.client.query("profiles:me", {}))?.role === "student", "sign-up creates a student even when the client asks for counselor");

// Wrong password is rejected.
let rejected = false;
try { await new ConvexHttpClient(CONVEX_URL).action("auth:signIn", { provider: "password", params: { email: nadia.email, password: "wrong-password-1", flow: "signIn" } }); } catch { rejected = true; }
ok(rejected, "sign-in with a wrong password fails");

const other = await signUp(`other+${run}@demo.test`, "Other (fictional)");
const ayu = await signUp(`ayu+${run}@demo.test`, "Ayu");
const budi = await signUp(`budi+${run}@demo.test`, "Budi");
// Deactivate counselors left over from earlier runs so the rotation is predictable.
convexRun("admin:makeCounselor", { email: ayu.email, displayName: "Counselor Ayu (fictional)", rotationOrder: run });
convexRun("admin:makeCounselor", { email: budi.email, displayName: "Counselor Budi (fictional)", rotationOrder: run + 1 });
ok((await ayu.client.query("profiles:me", {}))?.role === "counselor", "admin function grants the counselor role");

await nadia.client.mutation("profiles:upsertMine", { countries: ["US", "GB"], settings: [], majors: ["computer_science"], budgetAmount: 1200000000, budgetCurrency: "IDR", budgetPeriod: "annual", budgetScope: "all_in", intakeYear: 2027 });
const req = await nadia.client.mutation("counseling:request", { stage: "intake" });
ok(req.status === "assigned", `counseling request assigned (to ${req.counselorName})`);
const mine = req.counselorName?.startsWith("Counselor Ayu") ? ayu : budi;
const notMine = mine === ayu ? budi : ayu;

let denied = false;
try { await notMine.client.query("profiles:getForStudent", { studentId: (await nadia.client.query("profiles:me", {})).id }); } catch { denied = true; }
ok(denied, "the unassigned counselor cannot read Nadia's profile");
denied = false;
try { await other.client.query("profiles:getForStudent", { studentId: (await nadia.client.query("profiles:me", {})).id }); } catch { denied = true; }
ok(denied, "another student cannot read Nadia's profile");

await nadia.client.mutation("messages:send", { conversationId: req.conversationId, body: "Halo, saya Nadia (fiktif)." });
const thread = await mine.client.query("messages:list", { conversationId: req.conversationId });
ok(thread.some((m) => m.senderType === "student"), "assigned counselor reads the thread");

// Upload a fictional PDF through the real upload URL.
const pdf = new TextEncoder().encode("%PDF-1.4\n% SAMPLE - FICTIONAL\n%%EOF\n");
const uploadUrl = await nadia.client.mutation("files:generateUploadUrl", {});
const { storageId } = await (await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: pdf })).json();
const fin = await nadia.client.mutation("files:finishUpload", { storageId, name: "SAMPLE Transkrip.pdf" });
ok(fin.ok, "upload registered");
let state;
for (let i = 0; i < 20 && state !== "ready"; i++) { await new Promise((r) => setTimeout(r, 250)); state = (await nadia.client.query("files:listMine", {}))[0]?.state; }
ok(state === "ready", "signature check marks the PDF ready");

const dl = (token, extra = {}) => fetch(`${CONVEX_SITE_URL}/files/download?id=${fin.fileId}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra } });
const own = await dl(nadia.token, { Origin: "http://localhost:3000" });
ok(own.status === 200 && (await own.text()).startsWith("%PDF"), "owner downloads through the authenticated endpoint");
ok(own.headers.get("access-control-allow-origin") === "http://localhost:3000", "CORS allows the app origin");
ok(own.headers.get("content-disposition")?.startsWith("attachment"), "served as an attachment");
ok((await dl(null)).status === 401, "copied URL without a token: 401");
ok((await dl(other.token)).status === 404, "another student: 404");
ok((await dl(mine.token)).status === 404, "assigned counselor before sharing: 404");
await nadia.client.mutation("files:share", { fileId: fin.fileId });
ok((await dl(mine.token)).status === 200, "assigned counselor after sharing: 200");
ok((await dl(notMine.token)).status === 404, "unassigned counselor after sharing: 404");
const pre = await fetch(`${CONVEX_SITE_URL}/files/download`, { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
ok(pre.status === 204 && /authorization/i.test(pre.headers.get("access-control-allow-headers") ?? ""), "CORS preflight succeeds");

// Clean up so reruns stay predictable.
convexRun("admin:setCounselorActive", { email: ayu.email, active: false });
convexRun("admin:setCounselorActive", { email: budi.email, active: false });
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
