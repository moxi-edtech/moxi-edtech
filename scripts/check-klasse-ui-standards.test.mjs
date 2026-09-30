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
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function setupRepo(initialContent) {
  const cwd = mkdtempSync(path.join(tmpdir(), "klasse-ui-"));
  const absolute = path.join(cwd, relativeFile);
  mkdirSync(path.dirname(absolute), { recursive: true });
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.name", "KLASSE CI"]);
  git(cwd, ["config", "user.email", "ci@klasse.invalid"]);
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
    'export const Legacy = () => <div className="rounded-2xl text-[#E3B23C]">Legacy</div>;\n',
  );
  try {
    commitChange(
      cwd,
      absolute,
      'export const Legacy = () => <div className="rounded-2xl text-[#E3B23C]">Legacy</div>;\nexport const safe = true;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added direct brand hex still fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <span className="text-[#E3B23C]">New</span>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /KLASSE-TOKEN-001/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a newly added rounded-2xl operational card still fails", () => {
  const { cwd, absolute } = setupRepo("export const safe = true;\n");
  try {
    commitChange(
      cwd,
      absolute,
      'export const safe = true;\nexport const Added = () => <section className="rounded-2xl">New</section>;\n',
    );
    const result = runChecker(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /KLASSE-CARD-003/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("an explicit CI baseline scopes an alignment to the preserved product branch", () => {
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

    const result = runChecker(cwd, { KLASSE_UI_BASE_REF: productBaseline });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
