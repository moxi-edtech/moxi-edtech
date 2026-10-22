#!/usr/bin/env node
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";

// Conservative, synthetic REQUEST COUNT MODEL, not observed production traffic.
// v1 class overview fetched up to 3,000 enrolments in 500-row batches.
// v2 fetches one SQL aggregate; local search requests only when operator searches.
const args = new Map(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  return [key, Number(value)];
}));
const enrollments = args.get("enrollments") ?? 3000;
const classViewsPerHour = args.get("views") ?? 20;
const searchesPerHour = args.get("searches") ?? 20;
for (const value of [enrollments,classViewsPerHour,searchesPerHour]) {
  assert.ok(Number.isInteger(value) && value >= 0 && value < 100000, "Invalid request budget");
}
const originalBatchCalls = enrollments ? Math.ceil(Math.min(enrollments,3000) / 500) : 0;
const oldRequests = classViewsPerHour * originalBatchCalls;
const newRequests = classViewsPerHour * (classViewsPerHour ? 1 : 0) + searchesPerHour;
// This comparison covers ONLY the class-roster requests. Other unchanged reads
// run in both versions and cancel in the difference.
const result = {
  classification: "synthetic request-budget model (not telemetry)",
  input: { enrollments, classViewsPerHour, searchesPerHour },
  oldRosterRequestsPerHour: oldRequests,
  newRosterRequestsPerHour: newRequests,
  delta: newRequests - oldRequests,
  passesBudgetForWorkload: newRequests <= oldRequests,
};
await mkdir("docs/performance", { recursive: true });
await writeFile("docs/performance/command-center-request-budget.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
if (!result.passesBudgetForWorkload) process.exitCode = 1;
