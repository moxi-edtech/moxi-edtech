import path from "node:path";
import { readFileSync } from "node:fs";
import type { PerfGate } from "./types";
import { writeJson, writeText } from "../scan/io";
import type { ScanReport } from "../scan/types";

export async function runPerfGate(opts: { scanJson: string; outDir: string }) {
  const report = JSON.parse(readFileSync(opts.scanJson, "utf8")) as ScanReport;

  const blocking = report.findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH");

  const gate: PerfGate = {
    timestamp: new Date().toISOString(),
    status: blocking.length ? "FAIL" : "PASS",
    blocking_findings: blocking,
    notes: blocking.length
      ? ["Hard-gate ativo: CRITICAL/HIGH bloqueiam PR até resolver."]
      : ["PASS: sem bloqueios P0/P1."],
  };

  const md = [
    "# PERF_GATE.md",
    "",
    `Status: **${gate.status}**`,
    "",
    `## Blocking findings (${blocking.length})`,
    "",
    ...blocking.map((f) => `- **${f.id}** (${f.severity}/${f.status}) — ${f.title}`),
  ].join("\n");

  await writeJson(path.join(opts.outDir, "PERF_GATE.json"), gate);
  await writeText(path.join(opts.outDir, "PERF_GATE.md"), md);

  return gate;
}
