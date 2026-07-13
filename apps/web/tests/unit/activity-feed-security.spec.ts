import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACTIVITY_FEED_ALLOWED_FAMILIES,
  parseActivityFeedFamilies,
} from "../../src/lib/admin/activityFeed";

test("parseActivityFeedFamilies rejeita families inválido sem ampliar consulta", () => {
  const result = parseActivityFeedFamilies("financeiro,super_admin", ACTIVITY_FEED_ALLOWED_FAMILIES);

  assert.equal(result.error, "Família de eventos inválida");
  assert.deepEqual(result.families, []);
});

test("parseActivityFeedFamilies preserva fallback explícito quando filtro está ausente", () => {
  const result = parseActivityFeedFamilies(null, ["financeiro", "documentos"]);

  assert.equal(result.error, null);
  assert.deepEqual(result.families, ["financeiro", "documentos"]);
});

test("parseActivityFeedFamilies permite apenas famílias conhecidas", () => {
  const result = parseActivityFeedFamilies("financeiro,documentos", ACTIVITY_FEED_ALLOWED_FAMILIES);

  assert.equal(result.error, null);
  assert.deepEqual(result.families, ["financeiro", "documentos"]);
});

test("validarPagamentoAction resolve escola do pagamento antes de validar ou mutar", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    resolve(testDir, "../../src/features/financeiro/actions.ts"),
    "utf8"
  );

  const functionStart = source.indexOf("export async function validarPagamentoAction");
  const resolveIndex = source.indexOf("resolvePagamentoEscolaId(supabase, pagamentoId)", functionStart);
  const authIndex = source.indexOf("requireFinanceiroAccess(supabase, pagamentoEscolaId)", functionStart);
  const mutationIndex = source.indexOf('supabase.rpc("validar_pagamento"', functionStart);

  assert.notEqual(functionStart, -1);
  assert.notEqual(resolveIndex, -1);
  assert.notEqual(authIndex, -1);
  assert.notEqual(mutationIndex, -1);
  assert.ok(resolveIndex < authIndex, "payment school must be resolved before role check");
  assert.ok(authIndex < mutationIndex, "role check must run before validar_pagamento RPC");
});
