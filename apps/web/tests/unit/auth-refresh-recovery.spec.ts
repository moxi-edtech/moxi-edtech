import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd(), "../..");

test("server entrypoints inspect returned refresh errors as well as thrown errors", () => {
  for (const file of [
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/escola/[id]/professor/layout.tsx",
    "apps/web/src/app/(portal-aluno)/aluno/layout.tsx",
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /isRefreshTokenNotFoundError\((?:userResult|sessionResult)\.error\)/, file);
    assert.match(source, /auth-recover\?next=\/redirect/, file);
    assert.match(source, /if \((?:userResult|sessionResult)\.error\)/, file);
  }
});

test("secretaria guard recovers stale sessions without redirect cycling", () => {
  const source = fs.readFileSync(path.join(root, "apps/web/src/app/(guards)/RequireSecretaria.tsx"), "utf8");
  assert.match(source, /isRefreshTokenNotFoundError\(userErr\)/);
  assert.match(source, /window\.location\.replace\("\/auth-recover\?next=\/redirect"\)/);
  assert.match(source, /setAuthUnavailable\(true\)/);
  assert.doesNotMatch(source, /if \(userErr \|\| !user\)[\s\S]{0,50}router\.replace\("\/redirect"\)/);
});

test("existing shared-cookie recovery keeps domain-wide cookie cleanup", () => {
  const source = fs.readFileSync(path.join(root, "apps/web/src/app/auth-recover/route.ts"), "utf8");
  assert.match(source, /\.klasse\.ao/);
  assert.match(source, /name\.startsWith\("sb-"\)/);
  assert.match(source, /maxAge: 0/);
});
