import assert from "node:assert/strict";
import test from "node:test";

import { isKf2RelevantPath, shouldRunKf2 } from "./kf2-path-filter.mjs";

const pr132Files = [
  "apps/auth/vercel.json",
  "apps/formacao/vercel.json",
  "apps/landing/vercel.json",
  "apps/web/vercel.json",
  "scripts/vercel-ignore-build.mjs",
  "vercel.json",
];

test("PR #132 Vercel-only file set does not spend a KF2 run", () => {
  assert.equal(shouldRunKf2(pr132Files), false);
});

test("docs-only changes do not spend a KF2 run", () => {
  assert.equal(shouldRunKf2(["docs/architecture.md", "README.md"]), false);
});

test("other app-only changes do not run the web KF2 gate", () => {
  assert.equal(shouldRunKf2(["apps/auth/src/app/page.tsx"]), false);
  assert.equal(shouldRunKf2(["apps/formacao/src/app/page.tsx"]), false);
});

test("web runtime changes run KF2", () => {
  assert.equal(isKf2RelevantPath("apps/web/src/app/api/alunos/route.ts"), true);
});

test("Supabase and agent changes run KF2", () => {
  assert.equal(shouldRunKf2(["supabase/migrations/20990101_test.sql"]), true);
  assert.equal(shouldRunKf2(["agents/scan/checks.ts"]), true);
});

test("workspace dependency changes run KF2", () => {
  assert.equal(shouldRunKf2(["pnpm-lock.yaml"]), true);
  assert.equal(shouldRunKf2(["packages/auth/src/index.ts"]), true);
});

test("unknown paths fail open", () => {
  assert.equal(shouldRunKf2(["new-runtime-area/config.json"]), true);
  assert.equal(shouldRunKf2([]), true);
});
