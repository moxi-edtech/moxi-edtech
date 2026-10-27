#!/usr/bin/env node
/**
 * Incremental theme guard. Examine added lines across shared UI and portals;
 * pre-existing hardcoded colors remain tech debt, not a CI escape hatch.
 * Print-only utilities and generated receipts are deliberately exempt.
 */
import { execFileSync } from "node:child_process";

const base = process.env.THEME_GUARD_BASE_REF?.trim()
  || (process.env.GITHUB_BASE_REF ? "origin/" + process.env.GITHUB_BASE_REF : "HEAD~1");

const rules = [
  {
    id: "THEME-NEUTRAL-001",
    message: "Use bg-card, bg-background or bg-muted instead of fixed neutral surfaces.",
    pattern: /\b(?:bg|hover:bg|focus:bg|group-hover:bg)-(?:white|slate-(?:50|100|200|300|400|500|600|700|800|900|950)|gray-(?:50|100|200|300|400|500|600|700|800|900|950)|zinc-(?:50|100|200|300|400|500|600|700|800|900|950))(?:\/\d+)?\b/,
  },
  {
    id: "THEME-NEUTRAL-002",
    message: "Use text-foreground or text-muted-foreground instead of fixed neutral text.",
    pattern: /\b(?:text|hover:text|focus:text|placeholder:text)-(?:slate|gray|zinc|neutral)-(?:[3-9]00|950)(?:\/\d+)?\b/,
  },
  {
    id: "THEME-NEUTRAL-003",
    message: "Use border-border, border-ring or ring-ring for theme-aware edges.",
    pattern: /\b(?:border|ring|ring-offset|hover:border|focus:border)-(?:white|slate-(?:[1-9]00|950)|gray-(?:[1-9]00|950)|zinc-(?:[1-9]00|950))(?:\/\d+)?\b/,
  },
  {
    id: "THEME-BRAND-001",
    message: "Use theme-aware brand/semantic tokens rather than inline brand hex.",
    pattern: /#(?:1F6B3B|E3B23C|2B6044|C8902A)\b/i,
  },
];

function eligible(file) {
  const inUi = file.startsWith("apps/web/src/components/") || file.startsWith("apps/web/src/app/");
  const excluded = /\/(?:api|print|__tests__)\//.test(file)
    || file.includes("/app/(auth)/")
    || /(?:\/print\/|Printable|PrintView|\.print\.)/.test(file);
  return inUi && !excluded && /\.[jt]sx?$/.test(file);
}

let diff;
try {
  diff = execFileSync("git", [
    "diff", "--unified=0", "--no-color", "--diff-filter=ACMR",
    base + "...HEAD", "--", "apps/web/src/components", "apps/web/src/app"
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  console.error("Theme Switcher Guard: cannot compare with " + base + " (full git history required).");
  console.error(String(error.message));
  process.exit(2);
}

let file = "";
let nextLine = 0;
const findings = [];
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
    continue;
  }
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunk) {
    nextLine = Number(hunk[1]);
    continue;
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    const added = line.slice(1);
    // Print-only declarations are intentionally white, regardless of the app theme.
    const screenOnly = added.replace(/\bprint:(?:bg|text|border|ring|ring-offset)-[\w/[\]#().%-]+/g, "");
    if (eligible(file) && !/\bisPrintView\b.*\bbg-white\b/.test(screenOnly)) {
      for (const rule of rules) {
        if (rule.pattern.test(screenOnly)) {
          findings.push({ id: rule.id, file, line: nextLine, message: rule.message, evidence: added.trim() });
        }
      }
    }
    nextLine += 1;
  } else if (line.startsWith(" ") && !line.startsWith("diff ")) {
    nextLine += 1;
  }
}

if (findings.length) {
  console.error("Theme Switcher Guard: " + findings.length + " new fixed-color violation(s).");
  for (const f of findings) {
    console.error(f.id + " " + f.file + ":" + f.line + "\n  " + f.message + "\n  " + f.evidence);
  }
  process.exit(1);
}
console.log("Theme Switcher Guard passed: no new fixed neutral surfaces/text/edges or inline brand hex.");