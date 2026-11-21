import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseImportHistoryCursor,
  parseImportHistoryLimit,
} from "../../src/app/api/migracao/import-school-context";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("migration cursor preserves microsecond precision and rejects PostgREST filter injection", () => {
  const id = "72dcceaf-51f9-4a9b-a953-dc0505b875c7";
  const timestamp = "2026-11-21T18:01:02.123456+00:00";
  assert.deepEqual(parseImportHistoryCursor(`${timestamp},${id}`), { createdAt: timestamp, id });
  assert.equal(parseImportHistoryCursor(null), null);
  for (const cursor of [
    "not-a-cursor",
    "2026-11-21T18:01:02Z,not-a-uuid",
    `2026-11-21T18:01:02Z,${id},or(escola_id.neq.foo)`,
    `2026-11-21T18:01:02Z,evil)${id}`,
    `2026-13-99T99:99:99Z,${id}`,
  ]) assert.equal(parseImportHistoryCursor(cursor), "invalid", cursor);
  assert.equal(parseImportHistoryLimit(null), 30);
  assert.equal(parseImportHistoryLimit("50"), 50);
  assert.equal(parseImportHistoryLimit("100"), 50);
  for (const invalid of ["0", "-1", "NaN", "2.5", ""]) {
    assert.equal(parseImportHistoryLimit(invalid), null);
  }
});

test("import history is scoped to exactly the requested authorized school", () => {
  const api = source("app/api/migracao/historico/route.ts");
  const auth = source("app/api/migracao/import-school-context.ts");
  assert.match(api, /resolveAuthorizedImportSchool/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.doesNotMatch(api, /\.in\("escola_id", escolaIds\)/);
  assert.match(api, /maxLimit: 51/);
  assert.match(api, /fetched\.length > limit/);
  assert.match(auth, /resolveEscolaIdForUser/);
  assert.match(auth, /requireRoleInSchool/);
  assert.match(auth, /K12_SECRETARIA_OPERACIONAL_ROLE_GROUP/);
  assert.match(auth, /safeParse\(suppliedId\)/);
});

test("read, rename, delete and error details fail closed for another school", () => {
  const actions = source("app/api/migracao/[importId]/route.ts");
  const errors = source("app/api/migracao/[importId]/erros/route.ts");
  assert.match(actions, /resolveAuthorizedImportSchool/);
  assert.ok((actions.match(/\.eq\("escola_id", scope\.escolaId\)/g) ?? []).length >= 4);
  assert.match(actions, /\.update\(\{ file_name: name \}\)/);
  assert.match(actions, /\.delete\(\)/);
  assert.match(errors, /\.eq\("escola_id", scope\.escolaId\)/);
  assert.match(errors, /status: 404/);
});

test("client passes a school context and hides obsolete cross-tenant results", () => {
  const list = source("components/secretaria/ImportacoesListClient.tsx");
  const actions = source("app/secretaria/(portal-secretaria)/importacoes/RowActions.tsx");
  const detail = source("app/secretaria/(portal-secretaria)/importacoes/[id]/page.tsx");
  assert.match(list, /escola_id: escolaId/);
  assert.match(list, /loadedSchoolId === escolaId/);
  assert.match(list, /visibleItems/);
  assert.match(list, /requestRef\.current\?\.abort\(\)/);
  assert.match(actions, /encodeURIComponent\(escolaId\)/);
  assert.match(detail, /searchParams/);
  assert.match(detail, /getErros\(importId, escolaId\)/);
});
