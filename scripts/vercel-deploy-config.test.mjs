import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const vercelConfigs = [
  "vercel.json",
  "apps/web/vercel.json",
  "apps/auth/vercel.json",
  "apps/landing/vercel.json",
  "apps/formacao/vercel.json",
];

test("Vercel projects rely on native skip, never an Ignored Build Step", () => {
  for (const path of vercelConfigs) {
    const config = JSON.parse(read(path));
    assert.equal(
      Object.hasOwn(config, "ignoreCommand"),
      false,
      `${path} reintroduces a billable Ignored Build Step; use native affected-project skipping`,
    );
  }
});

test("workspace discovery includes deployable apps and shared packages", () => {
  const workspaces = read("pnpm-workspace.yaml");
  assert.match(workspaces, /^\s*- ['"]?apps\/\*['"]?\s*$/m);
  assert.match(workspaces, /^\s*- ['"]?packages\/\*['"]?\s*$/m);
  for (const app of ["web", "auth", "landing", "formacao"]) {
    const manifest = JSON.parse(read(`apps/${app}/package.json`));
    assert.ok(manifest.name, `apps/${app} requires a workspace package name`);
  }
});
