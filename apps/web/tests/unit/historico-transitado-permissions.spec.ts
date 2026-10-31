import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { requireHistoricoTransitadoPermission } from "../../src/lib/authz/historicoTransitado";

function clientWithResponse(
  response: { data: unknown; error: unknown } | Error,
  calls: Array<{ name: string; escolaId: string }>,
) {
  return {
    rpc: async (name: string, args: { p_escola_id: string }) => {
      calls.push({ name, escolaId: args.p_escola_id });
      if (response instanceof Error) throw response;
      return response;
    },
  } as any;
}

test("histórico transitado aceita unicamente TRUE da capacidade académica", async () => {
  const calls: Array<{ name: string; escolaId: string }> = [];
  const allowed = await requireHistoricoTransitadoPermission(
    clientWithResponse({ data: true, error: null }, calls), "school-1",
  );
  assert.equal(allowed, null);
  assert.deepEqual(calls, [{ name: "can_manage_historico_transitado", escolaId: "school-1" }]);

  const wrongType = await requireHistoricoTransitadoPermission(
    clientWithResponse({ data: "true", error: null }, []), "school-1",
  );
  assert.equal(wrongType?.status, 403);
});

test("sem permissão responde 403, sem consultar aliases de papéis", async () => {
  const response = await requireHistoricoTransitadoPermission(
    clientWithResponse({ data: false, error: null }, []), "school-1",
  );
  assert.equal(response?.status, 403);
  assert.match(JSON.stringify(await response?.json()), /permissão/);
});

test("falha da RPC ou erro de rede falham fechados com 503", async () => {
  const failingRPC = await requireHistoricoTransitadoPermission(
    clientWithResponse({ data: null, error: { code: "PGRST202" } }, []), "school-1",
  );
  assert.equal(failingRPC?.status, 503);
  const thrown = await requireHistoricoTransitadoPermission(
    clientWithResponse(new Error("unavailable"), []), "school-1",
  );
  assert.equal(thrown?.status, 503);
});

test("as duas APIs exigem a capacidade académica antes de ler ou escrever", () => {
  const routes = [
    new URL("../../src/app/api/secretaria/historico-transitado/route.ts", import.meta.url),
    new URL("../../src/app/api/secretaria/alunos/[id]/historico-transitado/route.ts", import.meta.url),
  ];
  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /requireHistoricoTransitadoPermission\(supabase, escolaId\)/);
    assert.doesNotMatch(source, /requireRoleInSchool\(/);
  }
});

test("migração contém matriz académica explícita sem papel financeiro puro", () => {
  const source = readFileSync(
    new URL("../../../../supabase/migrations/20271031001000_historico_transitado_academic_permissions_ssot_20261030.sql", import.meta.url),
    "utf8",
  );
  const roles = source.match(/eu\.papel IN \(([\s\S]*?)\)/)?.[1] ?? "";
  for (const role of ["admin", "admin_escola", "staff_admin", "secretaria", "admin_secretaria", "admin_financeiro", "secretaria_financeiro"]) {
    assert.ok(roles.includes(`'${role}'`), `Missing academic role ${role}`);
  }
  assert.ok(!roles.includes("'financeiro'"), "Pure finance role must never grant history access");
  assert.equal((source.match(/^ALTER POLICY /gm) ?? []).length, 8);
});
