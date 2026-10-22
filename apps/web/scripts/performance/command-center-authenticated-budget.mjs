/**
 * Authenticated budget harness for a disposable KLASSE preview/database.
 *
 * Read only. Never stores API payloads, cookie, names or student identifiers.
 * The exact same request shape can be measured before and after an approved
 * branch rollout. No production target unless separately authorised.
 *
 * Env:
 *   KLASSE_CC_BENCHMARK_URL=http://127.0.0.1:3000
 *   KLASSE_CC_BENCHMARK_COOKIE=<test user cookie>
 *   KLASSE_CC_BENCHMARK_PATH=/api/escolas/<fictional-uuid>/command-center/roster?... 
 *   KLASSE_CC_BENCHMARK_COUNT=8 (maximum 12, respects rate limit)
 *   KLASSE_CC_ALLOW_PREVIEW_TEST=1 to allow non-local preview (not production).
 */
import { performance } from "node:perf_hooks";

const base = process.env.KLASSE_CC_BENCHMARK_URL;
const path = process.env.KLASSE_CC_BENCHMARK_PATH;
const session = process.env.KLASSE_CC_BENCHMARK_COOKIE;
const count = Number(process.env.KLASSE_CC_BENCHMARK_COUNT ?? "8");

if (!base || !path || !session) throw new Error("Authenticated benchmark needs base URL, relative path and session cookie.");
const root = new URL(base);
if (!["http:", "https:"].includes(root.protocol) ||
  root.hostname === "app.klasse.ao" || root.hostname.endsWith(".klasse.ao")) {
  throw new Error("The production domain is forbidden in this benchmark.");
}
const local = ["localhost","127.0.0.1","::1","[::1]"].includes(root.hostname);
if (!local && process.env.KLASSE_CC_ALLOW_PREVIEW_TEST !== "1") {
  throw new Error("Remote targets require explicit KLASSE_CC_ALLOW_PREVIEW_TEST=1.");
}
if (!path.startsWith("/api/escolas/") || path.includes("://") || path.startsWith("//")) {
  throw new Error("Use an authorised relative school API path only.");
}
if (!Number.isInteger(count) || count < 3 || count > 12) {
  throw new Error("Choose 3–12 samples to avoid per-operator quota exhaustion.");
}
const url = new URL(path,root);
const timings = [];
const bytes = [];
const serverTimings = [];
for (let i=0;i<count;i++) {
  const started=performance.now();
  const response=await fetch(url,{
    method:"GET",
    redirect:"manual",
    headers:{Cookie:session,"Cache-Control":"no-cache"},
    cache:"no-store",
  });
  const payload=await response.arrayBuffer();
  const durationMs=performance.now()-started;
  if (!response.ok) {
    throw new Error(`Benchmark request failed: HTTP ${response.status}`); // no payload/PII
  }
  timings.push(durationMs);
  bytes.push(payload.byteLength);
  const reported=response.headers.get("Server-Timing")?.match(/cc;dur=([0-9.]+)/)?.[1];
  if (reported) serverTimings.push(Number(reported));
}
const sorted=timings.toSorted((a,b)=>a-b);
const percentile=(items,p)=>items[Math.min(items.length-1,Math.ceil(p*items.length)-1)];
const details={
  scope:"fictional-authenticated-disposable-only",
  count,
  status:"all HTTP 2xx",
  requestBytes:{ min:Math.min(...bytes),max:Math.max(...bytes),
    mean:Math.round(bytes.reduce((a,b)=>a+b,0)/bytes.length) },
  clientLatencyMs:{p50:Number(percentile(sorted,.5).toFixed(1)),
    p95:Number(percentile(sorted,.95).toFixed(1))},
  serverTimingP95Ms:serverTimings.length===count
    ? Number(percentile(serverTimings.toSorted((a,b)=>a-b),.95).toFixed(1))
    : null,
  requestsPerRun:count,
};
console.log(JSON.stringify(details,null,2));
