import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toolSchemas } from "../../src/lib/integrations/klasse-chatgpt/schemas";

const migration = readFileSync("../../supabase/migrations/20260927232530_klasse_chatgpt_readonly_rpcs.sql", "utf8");

test("public tool schemas never accept a tenant id", () => {
  for (const schema of Object.values(toolSchemas)) {
    const result = schema.safeParse({ school_id: "00000000-0000-0000-0000-000000000000", escola_id: "00000000-0000-0000-0000-000000000000" });
    if (result.success) {
      assert.equal("school_id" in result.data, false);
      assert.equal("escola_id" in result.data, false);
    }
  }
});

test("all exposed RPCs are invoker functions and denied to anon", () => {
  assert.equal((migration.match(/SECURITY INVOKER/g) ?? []).length, 7);
  assert.equal((migration.match(/FROM PUBLIC, anon/g) ?? []).length, 7);
  assert.doesNotMatch(migration, /service_role/i);
});

