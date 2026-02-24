import type { ScanReport } from "./types";

export function buildReportMarkdown(report: ScanReport) {
  const lines: string[] = [];
  lines.push("# REPORT_SCAN.md — KLASSE FOUNDATION AUDIT");
  lines.push("");
  lines.push(`- Verificado em: \`${report.timestamp}\``);
  lines.push("");
  lines.push("## 1. SUMÁRIO EXECUTIVO");
  lines.push("");
  lines.push(`- Findings CRÍTICOS: **${report.summary.critical}**`);
  lines.push(`- Findings ALTO: **${report.summary.high}**`);
  lines.push(`- Total findings: **${report.summary.total}**`);
  lines.push("");
  lines.push("## 2. ACHADOS (ordenado por severidade)");
  lines.push("");

  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  const sorted = [...report.findings].sort((a, b) => order[a.severity] - order[b.severity]);

  for (const finding of sorted) {
    lines.push(`### ${finding.id} — ${finding.title}`);
    lines.push(`- Severidade: **${finding.severity}**`);
    lines.push(`- Status: **${finding.status}**`);
    lines.push(`- Evidências:`);
    if (!finding.evidence.length) {
      lines.push("  - `-` — (sem evidências)");
    }
    for (const evidence of finding.evidence) {
      lines.push(`  - \`${evidence.file}\` — ${evidence.note}`);
    }
    lines.push(`- Recomendação: ${finding.recommendation}`);
    lines.push("");
  }

  return lines.join("\n");
}
