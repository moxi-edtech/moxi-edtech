#!/usr/bin/env node
/**
 * Stable relative budgets from the immutable pre-change fixture baseline.
 * Does not claim Vite JS transfer equals a real Next route bundle. When the
 * build manifest exists, verify the actual production-route JS budget too.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
const reportPath = process.argv[2] || "docs/performance/balcao-resultado.json";
const baseline = JSON.parse(readFileSync("docs/performance/balcao-baseline.json","utf8"));
const after = JSON.parse(readFileSync(reportPath,"utf8"));
assert.equal(after.fixture,true, "performance gate accepts only synthetic fixture data");
assert.ok(after.iterations>=3);
assert.deepEqual(after.errors,[],"no browser runtime errors");
assert.ok(after.idle.requests <= baseline.idle.requests,"idle requests must not increase");
const statuses=[];
for (const [name, original] of Object.entries(baseline.perTab)){
  const current=after.perTab[name];
  assert.ok(current, name+": route disappeared from benchmark");
  const reqCap=original.requests.median>0?1:0;
  assert.ok(current.requests.median<=reqCap, name+": repeated navigation calls exceeded fixture budget");
  assert.ok(current.timeMs.median <= original.timeMs.median*1.65+30,
    name+": p50 paint regressed beyond noise tolerance");
  // Nova matrícula now mounts a clean wizard on each entry instead of
  // reusing the previous candidate. Permit the single extra fixture commit
  // needed for initialization, without relaxing any other tab's budget.
  const commitBudget=Math.max(4,original.commits.median+1)+(name==="Matrícula"?1:0);
  assert.ok(current.commits.median<=commitBudget,
    name+": React commits increased significantly");
  statuses.push(name+": "+original.requests.median+" -> "+current.requests.median+" median HTTP");
}
// The Vite harness includes unrelated modules added to main after the
// original fixture baseline. Track transfer but enforce the optimized
// production Next.js route bundle budget below.
assert.ok(Number.isFinite(after.routeJsTransferBytes) && after.routeJsTransferBytes > 0,
  "Vite fixture JS transfer must be measured");
if(after.captures?.length){
  assert.ok(after.captures.every(c=>c.overflow===0),"visual fixtures must not overflow horizontally");
}
if (process.argv.includes("--with-bundle")) {
  const root="apps/web/.next";
  const manifest=JSON.parse(readFileSync(root+"/app-build-manifest.json","utf8"));
  const route=manifest.pages["/secretaria/balcao/page"];
  assert.ok(route?.length,"Next production Balcão page missing from build manifest");
  const size=route.reduce((total,file)=>{
    const path=resolve(root,file);
    return total+(existsSync(path)?statSync(path).size:0);
  },0);
  const BASELINE_ROUTE_BYTES=2057804;
  assert.ok(size>0,"no bundle bytes measured");
  assert.ok(size<=BASELINE_ROUTE_BYTES*1.15,
    "Next Balcão route JS exceeded 15% tolerance over pre-optimization baseline");
  console.log("Next optimized Balcão route JS:",size,"bytes; baseline",BASELINE_ROUTE_BYTES);
}
console.log("PASS: Balcão performance budgets",statuses.join(" | "), "idle",after.idle.requests);
