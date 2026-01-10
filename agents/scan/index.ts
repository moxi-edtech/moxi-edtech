import path from "node:path";
import fg from "fast-glob";
import type { ScanReport } from "./types";
import { buildReportMarkdown } from "./report";
import { writeJson, writeText } from "./io";
import { runChecks } from "./checks";

export async function runScan(opts: {
  repoRoot: string;
  contractsDir: string;
  outDir: string;
}) {
  const repoRoot = path.resolve(opts.repoRoot);
  const outDir = path.resolve(opts.outDir);

  const files = await fg(["**/*"], {
    cwd: repoRoot,
    dot: true,
    onlyFiles: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.next/**",
      "**/dist/**",
      "**/agents/**",
      "**/tmp/**",
      "**/*.bak",
      "**/REPORT_SCAN.md",
    ],
  });

  const { findings, plan } = await runChecks({
    repoRoot,
    files,
    contractsDir: opts.contractsDir,
  });

  const summary = {
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    total: findings.length,
  };

  const report: ScanReport = {
    timestamp: new Date().toISOString(),
    repoRoot,
    summary,
    findings,
  };

  await writeJson(path.join(outDir, "REPORT_SCAN.json"), report);
  await writeText(path.join(outDir, "REPORT_SCAN.md"), buildReportMarkdown(report));
  await writeJson(path.join(outDir, "PLAN_PATCHES.json"), plan);

  return { report, plan };
}
