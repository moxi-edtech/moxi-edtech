import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const web = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const sql = readFileSync(
  resolve(process.cwd(), "..", "..", "supabase", "migrations",
    "20271109000000_raa_pendentes_via_academica.sql"), "utf8",
);

test("RAA resolves inherit_school subjects from the curriculum instead of dropping them", () => {
  const server = web("lib/academico/raa-progression-server.ts");
  assert.match(server, /matrix\.disciplina_id/);
  assert.match(server, /row\.avaliacao_disciplina_id/);
  assert.match(server, /loadCanonicalRaaLinks\(supabase, escolaId, turmaId\)/);
  assert.match(sql, /COALESCE\(td\.avaliacao_disciplina_id, cm\.avaliacao_disciplina_id, cm\.disciplina_id\)/);
  assert.doesNotMatch(server, /\.not\("avaliacao_disciplina_id", "is", null\)/);
});

test("pending is an administrative enrollment status, not an academic decision", () => {
  const api = web("app/api/secretaria/notas/route.ts");
  const balc = web("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(api, /row\.status === 'pendente'/);
  assert.match(api, /row\.status_fecho_origem == null/);
  assert.match(balc, /"ativo", "ativa", "active", "pendente"/);
  assert.match(sql, /m\.status = 'pendente'/);
  assert.match(sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.historico_anos/);
  assert.doesNotMatch(api, /\.update\(\{\s*(?:status|ativo):/);
});

test("grade writers remain tenant- and role-bound with official-year guards", () => {
  const api = web("app/api/secretaria/notas/route.ts");
  assert.match(api, /authorizeTurmasManage/);
  assert.match(api, /resolveAcademicYearContext/);
  assert.match(api, /operation: 'WRITE'/);
  assert.match(api, /assertAcademicYearEntity/);
  assert.match(api, /GRADE_PERIOD_UNRESOLVED/);
  assert.match(api, /OFFICIAL_CALENDAR_NOT_RECONCILED/);
  assert.match(api, /ACTIVE_ENROLLMENT_REQUIRED/);
  assert.match(sql, /public\.current_tenant_escola_id\(\)/);
  assert.match(sql, /public\.user_has_role_in_school/);
  assert.match(sql, /v\.matricula_year_id IS DISTINCT FROM v\.turma_year_id/);
  assert.match(sql, /ACADEMIC_PERIOD_LOCKED/);
});

test("the historical 2025 case is NOT reopened by this migration", () => {
  const api = web("app/api/secretaria/notas/route.ts");
  assert.match(api, /operation: 'WRITE'/);
  assert.match(sql, /ACADEMIC_YEAR_READ_ONLY/);
  assert.match(sql, /v_ano_ativo/);
  assert.match(sql, /m\.status_fecho_origem IS NULL/);
  assert.match(sql, /v\.matricula_origin_closed IS NULL/);
  assert.doesNotMatch(sql, /UPDATE public\.matriculas SET status\s*=\s*'ativo'/i);
});

test("migration preserves all canonical function signatures", () => {
  for (const name of [
    "lancar_notas_batch",
    "guard_grade_period_source_and_window",
    "raa_nota_percurso_atual",
    "resolve_estado_resultado_academico_base",
    "resolve_raa_decreto_for_matricula",
    "resolve_raa_progression_for_matricula_generic",
  ]) {
    assert.match(sql, new RegExp("CREATE OR REPLACE FUNCTION public\\." + name + "\\("));
  }
  assert.match(sql, /^BEGIN;[\s\S]*COMMIT;\s*$/m);
});
