#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const fileExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

const rules = [
  {
    id: "KLASSE-CARD-001",
    message: "Use klasseSurface.card/cardCompact/cardInteractive instead of rounded-lg with shadow-none.",
    test: (line) => /rounded-lg[^"'`]*shadow-none|shadow-none[^"'`]*rounded-lg/.test(line),
  },
  {
    id: "KLASSE-CARD-002",
    message: "Do not combine shadow-none with hover:shadow-none on operational surfaces.",
    test: (line) => /shadow-none[^"'`]*hover:shadow-none|hover:shadow-none[^"'`]*shadow-none/.test(line),
  },
  {
    id: "KLASSE-TOKEN-001",
    message: "Use Tailwind tokens or @moxi/design-tokens instead of direct KLASSE brand hex.",
    test: (line) => /#(?:1F6B3B|E3B23C)\b/i.test(line),
  },
  {
    id: "KLASSE-CARD-003",
    message: "Operational cards must use rounded-xl unless an exception applies.",
    test: (line, file) => isOperationalFile(file) && /\brounded-2xl\b/.test(line),
  },
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

function comparisonRange() {
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}...HEAD`;
  if (process.env.CI) return "HEAD~1..HEAD";
  return null;
}

function changedFiles() {
  if (explicitFiles.length > 0) return explicitFiles;

  const range = comparisonRange();
  if (range) {
    try {
      return git(["diff", "--name-only", "--diff-filter=ACMR", range]);
    } catch {
      return git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD~1", "HEAD"]);
    }
  }

  const tracked = git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])];
}

function parseAddedLineNumbers(diff) {
  const added = new Set();

  for (const line of diff.split("\n")) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!match) continue;

    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) {
      added.add(start + offset);
    }
  }

  return added;
}

function addedLineNumbers(file) {
  if (explicitFiles.length > 0) return null;

  const primaryRange = comparisonRange();
  if (!primaryRange) return null;

  const ranges = primaryRange === "HEAD~1..HEAD" ? [primaryRange] : [primaryRange, "HEAD~1..HEAD"];

  for (const range of ranges) {
    try {
      const diff = execFileSync(
        "git",
        ["diff", "--unified=0", "--no-color", "--diff-filter=ACMR", range, "--", file],
        { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      return parseAddedLineNumbers(diff);
    } catch {
      // Try the fallback range; if all ranges fail, scan the whole file rather than bypass the gate.
    }
  }

  return null;
}

function isException(file) {
  const normalized = file.replaceAll(path.sep, "/").toLowerCase();
  const basename = path.basename(normalized);

  return (
    normalized.startsWith("apps/landing/") ||
    normalized.includes("/aluno/") ||
    normalized.includes("/modelo_portal_do_aluno/") ||
    normalized.includes("/android/") ||
    normalized.includes("/ios/") ||
    /modal|drawer|sheet|dialog|slideover/.test(basename) ||
    normalized.includes("/components/ui/dialog") ||
    normalized.includes("/components/ui/drawer") ||
    normalized.includes("/components/ui/sheet") ||
    normalized.includes("/print/")
  );
}

function isOperationalFile(file) {
  const normalized = file.replaceAll(path.sep, "/");
  return (
    normalized.includes("apps/web/src/components/layout/escola-admin/") ||
    normalized.includes("apps/web/src/components/shared/") ||
    normalized.includes("apps/web/src/components/dashboard/") ||
    normalized.includes("apps/web/src/components/feedback/") ||
    normalized.includes("apps/web/src/components/financeiro/") ||
    normalized.includes("apps/web/src/app/secretaria/(portal-secretaria)/") ||
    normalized.includes("apps/web/src/app/escola/[id]/(portal)/financeiro/") ||
    normalized.includes("apps/formacao/components/") ||
    normalized.includes("apps/formacao/app/(portal)/")
  );
}

function shouldScan(file) {
  const normalized = file.replaceAll(path.sep, "/");
  if (!existsSync(path.join(repoRoot, file))) return false;
  if (!fileExtensions.has(path.extname(file))) return false;
  if (normalized.startsWith("packages/design-tokens/")) return false;
  if (normalized.includes("/node_modules/") || normalized.includes("/.next/")) return false;
  if (isException(normalized)) return false;
  return isOperationalFile(normalized);
}

const findings = [];

for (const file of changedFiles().filter(shouldScan)) {
  const absolute = path.join(repoRoot, file);
  const lines = readFileSync(absolute, "utf8").split("\n");
  const addedLines = addedLineNumbers(file);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (addedLines !== null && !addedLines.has(lineNumber)) return;

    for (const rule of rules) {
      if (rule.test(line, file)) {
        findings.push({
          rule: rule.id,
          file,
          line: index + 1,
          message: rule.message,
          evidence: line.trim(),
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("KLASSE UI standards check failed:\n");
  for (const finding of findings) {
    console.error(`${finding.rule} ${finding.file}:${finding.line}`);
    console.error(`  ${finding.message}`);
    console.error(`  ${finding.evidence}\n`);
  }
  process.exit(1);
}

console.log("KLASSE UI standards check passed.");
