import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("./check-klasse-ui-standards.mjs", import.meta.url));
const relativeFile = "apps/web/src/components/dashboard/Test.tsx";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function setupRepo(initialContent) {
  const cwd = mkdtempSync(path.join(tmpdir(), "moxi-ui-"));
  const absolute = path.join(cwd, relativeFile);
  mkdirSync(path.dirname(absolute), { recursive: true });
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.name", "Moxi CI"]);
  git(cwd, ["config", "user.email", "ci@moxi.invalid"]);
  writeFileSync(absolute, initialContent);
  git(cwd, ["add", relativeFile]);
  git(cwd, ["commit", "-m", "baseline"]);
  git(cwd, ["update-ref", "refs/remotes/origin/main", git(cwd, ["rev-parse", "HEAD"])]);
  return { cwd, absolute };
}

function commitChange(cwd, absolute, content) {
  writeFileSync(absolute, content);
  git(cwd, ["add", relativeFile]);
  git(cwd, ["commit", "-m", "change"]);
}

function runChecker(cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [checker], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true", GITHUB_BASE_REF: "main", ...extraEnv },
  });
}

test("legacy violations on untouched lines do not fail a PR", () => {
  const { cwd, absolute } = setupRepo(
    'export const Legacy = () => <div className="rounded-[28px] text-[#E3B23C] shadow-2xl">Legacy</div>;\n',
  );
  try {
    commitChange(
      cwd,
      absolute,
      'export const Legacy = () => <div className="rounded-[28px] text-[#E3B23C] shadow-2xl">Legacy</div>;\nexport const safe = true;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added direct product brand hex fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <span className="text-[#E3B23C]">New</span>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MOXI-TOKEN-001/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added arbitrary operational radius fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <section className="rounded-[28px]">New</section>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MOXI-RADIUS-001/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added non-semantic operational radius fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <section className="rounded-3xl">New</section>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MOXI-RADIUS-002/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added oversized surface shadow fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <section className="shadow-2xl">New</section>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MOXI-ELEVATION-002/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("an explicit baseline scopes alignment work to subsequent changes", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Legacy = () => <span className="text-[#E3B23C]">Legacy</span>;\n',
    );
    const productBaseline = git(cwd, ["rev-parse", "HEAD"]);
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Legacy = () => <span className="text-[#E3B23C]">Legacy</span>;\nexport const alignmentSafe = true;\n',
    );

    const result = runChecker(cwd, { MOXI_UI_BASE_REF: productBaseline });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
