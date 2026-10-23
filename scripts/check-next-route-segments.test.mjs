import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DEFAULT_APP_ROOT, findDynamicRouteCollisions } from "./check-next-route-segments.mjs";

function withRoutes(paths, callback) {
  const directory = mkdtempSync(join(tmpdir(), "klasse-next-routes-"));
  try {
    for (const path of paths) {
      const file = join(directory, path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, "export async function GET() {}\n");
    }
    callback(findDynamicRouteCollisions(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("rejects the exact production regression: [id] alongside [matriculaId]", () => {
  withRoutes([
    "api/secretaria/admissoes/matriculas/[id]/workspace-context/route.ts",
    "api/secretaria/admissoes/matriculas/[matriculaId]/status/route.ts",
  ], (collisions) => {
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0].parent, "api/secretaria/admissoes/matriculas");
    assert.deepEqual(collisions[0].names, ["id", "matriculaId"]);
  });
});

test("allows multiple endpoints under one canonical dynamic parameter", () => {
  withRoutes([
    "api/secretaria/admissoes/matriculas/[matriculaId]/workspace-context/route.ts",
    "api/secretaria/admissoes/matriculas/[matriculaId]/status/route.ts",
    "api/secretaria/matriculas/[matriculaId]/route.ts",
    "api/escolas/[id]/route.ts",
  ], (collisions) => assert.deepEqual(collisions, []));
});

test("finds the same collision across pathless Next.js route groups", () => {
  withRoutes([
    "(school)/api/matriculas/[id]/workspace-context/route.ts",
    "(staff)/api/matriculas/[matriculaId]/status/route.ts",
  ], (collisions) => {
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0].parent, "api/matriculas");
  });
});

test("distinguishes normal, catch-all, and optional catch-all segments", () => {
  withRoutes([
    "api/files/[id]/route.ts",
    "api/files/[...parts]/route.ts",
    "api/files/[[...optionalParts]]/route.ts",
  ], (collisions) => assert.deepEqual(collisions, []));
});

test("current KLASSE route tree has no conflicting parameter names", () => {
  assert.deepEqual(findDynamicRouteCollisions(DEFAULT_APP_ROOT), []);
});
