import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL(
  "../../../../supabase/migrations/20271120120000_service_receipts_class_same_academic_year.sql",
  import.meta.url,
), "utf8");
const route = readFileSync(new URL(
  "../../src/app/api/secretaria/balcao/pagamentos/route.ts",
  import.meta.url,
), "utf8");

test("service receipt picks its class from the checkout school year, not enrollment updated_at", () => {
  assert.match(migration, /al\.id::text = v_pagamento\.meta->>'ano_letivo_id'/);
  assert.match(migration, /al\.ativo IS TRUE/);
  assert.match(migration, /m\.ano_letivo = COALESCE\(/);
  assert.match(migration, /m\.status IN \('ativo', 'ativa'\)/);
  assert.doesNotMatch(migration, /ORDER BY m\.updated_at/);
});

test("service receipt class is scoped to the student, school and same-year turma", () => {
  assert.match(migration, /m\.aluno_id = v_pagamento\.aluno_id/);
  assert.match(migration, /m\.escola_id = v_pagamento\.escola_id/);
  assert.match(migration, /t\.escola_id = v_pagamento\.escola_id/);
  assert.match(migration, /t\.ano_letivo = m\.ano_letivo/);
  assert.match(migration, /cl\.escola_id = v_pagamento\.escola_id/);
  assert.match(migration, /c\.escola_id = v_pagamento\.escola_id/);
  assert.match(migration, /ORDER BY m\.created_at DESC, m\.id DESC/);
});

test("the correction preserves existing receipts, payments, and existing SQL authorization", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\._emitir_recibo_servicos_operacional_internal/);
  assert.match(migration, /IF v_user_id IS NULL THEN/);
  assert.match(migration, /v_pagamento\.escola_id OR p\.current_escola_id = v_pagamento\.escola_id/);
  assert.match(migration, /WHERE tipo = 'recibo'/);
  assert.doesNotMatch(migration, /UPDATE public\.(documentos_emitidos|pagamentos|matriculas)/i);
  assert.doesNotMatch(migration, /DELETE FROM public\./i);
});

test("canonical Balcão saves the server-validated year only for services, preserving monthly histories", () => {
  assert.match(route, /resolveAcademicYearContext\(supabase as any/);
  assert.match(route, /\.\.\.\(payload\.mensalidade_id \? \{\} : \{ ano_letivo_id: academicContext\.anoLetivoId \}\)/);
  assert.match(route, /p_mensalidade_id: \(payload\.mensalidade_id \?\? null\)/);
  assert.match(route, /idempotency_key: idempotencyKey/);
});
