import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/aluno/push/subscribe/route.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20271130092000_push_subscriptions_tenant_rls.sql"),
  "utf8",
);

test("push subscriptions authorize the requested school before UPSERT", () => {
  const authorize = route.indexOf("resolveEscolaIdForUser(supabase, user.id, escola_id)");
  const upsert = route.indexOf('.from("aluno_push_subscriptions")');
  assert.ok(authorize >= 0 && authorize < upsert);
  assert.match(route, /status: 403/);
  assert.match(route, /escola_id: authorizedEscolaId/);
  assert.doesNotMatch(route, /escola_id: escola_id/);
});

test("push endpoints reject non-HTTPS and obvious internal network destinations", () => {
  assert.match(route, /endpointUrl\.protocol !== "https:"/);
  assert.match(route, /host\.includes\(":"\)/);
  assert.match(route, /\^\[0-9\.\]\+\$/);
  assert.match(route, /host\.endsWith\("\.internal"\)/);
});

test("PostgREST cannot bypass tenant membership via client-authored school IDs", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /DROP POLICY IF EXISTS "Users can manage their own subscriptions"/);
  assert.match(migration, /FOR ALL\s+TO authenticated/);
  const authChecks = migration.match(/user_id = \(SELECT auth\.uid\(\)\)/g) ?? [];
  const tenantChecks = migration.match(/public\.has_access_to_escola_fast\(escola_id\)/g) ?? [];
  assert.equal(authChecks.length, 2, "both USING and WITH CHECK must verify identity");
  assert.equal(tenantChecks.length, 2, "both USING and WITH CHECK must verify tenant");
});
