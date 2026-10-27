import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./check-theme-switcher-colors.mjs", import.meta.url));

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repo(file, baseline) {
  const cwd = mkdtempSync(path.join(tmpdir(), "klasse-theme-"));
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.name", "KLASSE CI"]);
  git(cwd, ["config", "user.email", "ci@klasse.invalid"]);
  const target = path.join(cwd, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, baseline);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", "baseline"]);
  const base = git(cwd, ["rev-parse", "HEAD"]);
  return { cwd, target, base };
}

function verify(file, before, after) {
  const { cwd, target, base } = repo(file, before);
  try {
    writeFileSync(target, after);
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "change"]);
    return spawnSync(process.execPath, [script], {
      cwd, encoding: "utf8",
      env: { ...process.env, THEME_GUARD_BASE_REF: base },
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("unchanged legacy classes do not block an unrelated addition", () => {
  const out = verify("apps/web/src/components/Old.tsx",
    'const old = "bg-white text-slate-900";\n',
    'const old = "bg-white text-slate-900";\nconst newSafe = "bg-card text-foreground";\n');
  assert.equal(out.status, 0, out.stderr);
});

test("new fixed neutral surface, text and border in a shared component are rejected", () => {
  const out = verify("apps/web/src/components/New.tsx", "export const ok = true;\n",
    'export const ok = true;\nconst bad = "bg-white border-slate-200 text-slate-900";\n');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /THEME-NEUTRAL-001/);
  assert.match(out.stderr, /THEME-NEUTRAL-002/);
  assert.match(out.stderr, /THEME-NEUTRAL-003/);
});

test("new fixed brand hex is rejected in a portal", () => {
  const out = verify("apps/web/src/app/professor/page.tsx", "export const ok = true;\n",
    'export const ok = true;\nconst bad = "text-[#1F6B3B]";\n');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /THEME-BRAND-001/);
});

test("semantic statuses and print-only whites remain allowed", () => {
  const out = verify("apps/web/src/components/New.tsx", "export const ok = true;\n",
    'export const ok = true;\nconst good = "border-destructive/30 bg-destructive/10 text-foreground print:bg-white";\n');
  assert.equal(out.status, 0, out.stderr);
});

test("a brand color defined in the central tokens package is allowed", () => {
  const out = verify("packages/design-tokens/src/new.ts", "export const ok = true;\n",
    'export const ok = true;\nexport const official = "#1F6B3B";\n');
  assert.equal(out.status, 0, out.stderr);
});
