import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveReopeningSubject,
  type ReopeningCurriculumLink,
} from "../../src/lib/academico/resolve-reopening-subject";

const ids = {
  catalogA: "10000000-0000-4000-8000-000000000001",
  catalogB: "10000000-0000-4000-8000-000000000002",
  teacher: "10000000-0000-4000-8000-000000000003",
};

function link(
  id: string,
  curriculum: string,
  assessed: string | null,
  override: string | null = null,
): ReopeningCurriculumLink {
  return {
    id,
    professor_id: ids.teacher,
    avaliacao_disciplina_id: assessed,
    curso_matriz: { disciplina_id: curriculum, avaliacao_disciplina_id: override },
  };
}

test("reproduz o defeito do HEAD: catálogo presente, disciplina avaliada NULL", () => {
  assert.deepEqual(
    resolveReopeningSubject([link("td-a", ids.catalogA, null)], ids.catalogA),
    { ok: false, code: "UNRECONCILED" },
  );
});

test("backfill inequívoco preserva o escopo da autorização", () => {
  const result = resolveReopeningSubject(
    [link("td-a", ids.catalogA, ids.catalogA)], ids.catalogA,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assessedSubjectId, ids.catalogA);
});

test("override curricular explícito resolve o identificador avaliado, não alarga a permissão", () => {
  const result = resolveReopeningSubject(
    [link("td-a", ids.catalogA, ids.catalogB, ids.catalogB)], ids.catalogA,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.assessedSubjectId, ids.catalogB);
  assert.deepEqual(
    resolveReopeningSubject([link("td-a", ids.catalogA, ids.catalogB, ids.catalogB)], ids.catalogB),
    { ok: false, code: "UNKNOWN" },
  );
});

test("disciplina inexistente, repetida ou avaliação partilhada não concedem acesso", () => {
  const one = link("td-a", ids.catalogA, ids.catalogA);
  const two = link("td-b", ids.catalogB, ids.catalogA, ids.catalogA);
  assert.deepEqual(resolveReopeningSubject([one, two], ids.catalogA),
    { ok: false, code: "SHARED_ASSESSMENT" });
  assert.deepEqual(resolveReopeningSubject([one, one], ids.catalogA),
    { ok: false, code: "UNKNOWN" });
  assert.deepEqual(resolveReopeningSubject([one], ids.catalogB),
    { ok: false, code: "UNKNOWN" });
});

test("migração apenas reconcilia dados e deixa a política e a escola intactas", () => {
  const migration = readFileSync(resolve(process.cwd(),
    "../../supabase/migrations/20271118100000_audit_grade_reopen_subject_resolution.sql"), "utf8");
  const route = readFileSync(resolve(process.cwd(),
    "src/app/api/professor/notas/reabertura/route.ts"), "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS disciplina_catalogo_id uuid/);
  assert.match(migration, /COUNT\(\*\) OVER \(PARTITION BY escola_id,turma_id,alvo\)/);
  assert.match(migration, /td\.avaliacao_disciplina_id IS NULL/);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION|CREATE POLICY|DROP POLICY|UPDATE public\.notas|SET ano =/i);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("ano_letivo_id", parsed\.data\.ano_letivo_id\)/);
  assert.match(route, /disciplina_catalogo_id: parsed\.data\.disciplina_id/);
  assert.match(route, /disciplina_id: disciplinaAvaliadaId/);
  assert.match(route, /resolveReopeningSubject/);
});

test("a revogação reutiliza EXPIRADO e exige estado anterior APROVADO", () => {
  const staff = readFileSync(resolve(process.cwd(),
    "src/app/api/secretaria/notas/reabertura/route.ts"), "utf8");
  assert.match(staff, /z\.enum\(\["APROVADO", "REJEITADO", "EXPIRADO"\]\)/);
  assert.match(staff, /parsed\.data\.status === "EXPIRADO" \? "APROVADO" : "PENDENTE"/);
  assert.match(staff, /motivo_decisao/);
  assert.match(staff, /expira_em: parsed\.data\.status === "APROVADO"/);
});
