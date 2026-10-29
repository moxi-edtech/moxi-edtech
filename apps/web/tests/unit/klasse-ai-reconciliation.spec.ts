import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { toolSchemas, allowedRolesByTool, writeToolNames } from "../../src/lib/integrations/klasse-chatgpt/schemas";

const apiSource = readFileSync("src/app/api/integrations/chatgpt/[tool]/route.ts", "utf8");
const sqlRead = readFileSync("../../supabase/migrations/20260927232530_klasse_chatgpt_readonly_rpcs.sql", "utf8");
const sqlWrite = readFileSync("../../supabase/migrations/20260928120000_klasse_chatgpt_write_rpcs.sql", "utf8");

test("integration never trusts a tenant identifier supplied by AI", () => {
  for (const [tool, schema] of Object.entries(toolSchemas)) {
    const parsed = schema.safeParse({ escola_id: "arbitrary", school_id: "arbitrary" });
    if (parsed.success) {
      assert.equal("escola_id" in parsed.data, false, tool);
      assert.equal("school_id" in parsed.data, false, tool);
    }
    assert.ok(allowedRolesByTool[tool as keyof typeof allowedRolesByTool].length > 0);
  }
});

test("JWT and school membership are checked before tool execution", () => {
  assert.match(apiSource, /readBearerToken\(request\)/);
  assert.match(apiSource, /auth\.getUser\(accessToken\)/);
  assert.match(apiSource, /resolveEscolaIdForUser\(supabase, auth\.user\.id\)/);
  assert.match(apiSource, /requireRoleInSchool\(/);
  assert.ok(apiSource.indexOf("requireRoleInSchool(") < apiSource.indexOf("runKlasseTool("));
});

test("write tools retain explicit confirmation and restricted RPCs", () => {
  assert.ok(writeToolNames.includes("confirmar_pagamento"));
  assert.ok(writeToolNames.includes("preparar_pagamento"));
  assert.match(sqlWrite, /SECURITY INVOKER/);
  assert.doesNotMatch(sqlWrite, /GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon/i);
  assert.match(sqlRead, /SECURITY INVOKER/);
});
