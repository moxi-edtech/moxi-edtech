import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const webRoot = process.cwd().replace(/\\/g, "/").endsWith("/apps/web")
  ? process.cwd()
  : resolve(process.cwd(), "apps/web");
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), "utf8");
const readSql = (path: string) => readFileSync(resolve(webRoot, "../../supabase/migrations/" + path), "utf8");

const create = readWeb("src/app/api/escolas/[id]/matriculas/novo/route.ts");
const close = readWeb("src/app/api/secretaria/matriculas/[matriculaId]/finalizar/route.ts");
const button = readWeb("src/components/secretaria/alunos/FinalizarMatriculaButton.tsx");
const confirmedCurrent = readWeb("src/app/api/secretaria/alunos/[id]/matricula-corrente/route.ts");
const migration = readSql("20271029150000_enrollment_context_atomic_authorized_create.sql");

test("new enrollment uses tenant-scoped, active academic year and class/curso expected by official turma", () => {
  assert.match(create, /resolveEscolaIdForUser/);
  assert.match(create, /requireRoleInSchool/);
  assert.match(create, /resolveAcademicYearScope/);
  assert.match(create, /operation: "WRITE"/);
  assert.match(create, /assertAcademicYearEntity/);
  assert.match(create, /matricula_criar_confirmar_por_turma_v1/);
  assert.match(create, /p_expected_classe_id: input\.classe_id/);
  assert.match(create, /p_expected_curso_id: input\.course_id \?\? null/);
  assert.match(create, /ENROLLMENT_OFFICIAL_FLOW_REQUIRED/);
  assert.match(create, /idempotent: Boolean\(data\.idempotent\)/);
  assert.doesNotMatch(create, /new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(create, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
  assert.doesNotMatch(create, /\.from\(["']matriculas["']\)[\s\S]*?\.update\(/);
});
test("atomically creates enrollment and does not reactivate pending/closed year transitions", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.matricula_criar_confirmar_por_turma_v1/);
  assert.match(migration, /public\.user_has_role_in_school\(p_escola_id/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_existing\.status='ativo'/);
  assert.match(migration, /ENROLLMENT_EXISTING_REVIEW_REQUIRED/);
  assert.match(migration, /ENROLLMENT_CLASS_MISMATCH/);
  assert.match(migration, /ENROLLMENT_COURSE_MISMATCH/);
  assert.match(migration, /ENROLLMENT_TURMA_CLOSED_OR_INACTIVE/);
  assert.match(migration, /ENROLLMENT_CLASS_FULL/);
  assert.match(migration, /public\.confirmar_matricula_core\(p_aluno_id,v_year\.ano,p_turma_id,NULL\)/);
  assert.match(migration, /ENROLLMENT_TRANSACTION_POSTCONDITION_FAILED/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.create_or_confirm_matricula/);
});
test("all enrollment inserts and changes are protected by the official turma/session context", () => {
  assert.match(migration, /CREATE TRIGGER trg_klasse_guard_matricula_turma_context/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF turma_id,session_id,ano_letivo,escola_id,aluno_id,status/);
  assert.match(migration, /ENROLLMENT_STUDENT_TENANT_MISMATCH/);
  assert.match(migration, /ENROLLMENT_TURMA_CLASS_COURSE_MISMATCH/);
  assert.match(migration, /ENROLLMENT_SESSION_MISMATCH/);
  assert.match(migration, /ENROLLMENT_ACADEMIC_YEAR_MISMATCH/);
  assert.match(migration, /NEW\.session_id:=v_turma\.session_id/);
  assert.match(migration, /NEW\.ano_letivo:=v_turma\.ano_letivo/);
});
test("finalization uses authoritative GradeEngine; no arbitrary pass/fail or receipt issuance", () => {
  assert.match(button, /is_override_manual: false/);
  assert.match(button, /O resultado será calculado pelas notas e pautas oficiais/);
  assert.doesNotMatch(button, /novo_status:|setStatusFinal|statusFinal|comprovante-matricula|window\.open/);
  assert.match(close, /finalizar_matricula_blindada/);
  assert.match(close, /result\?\.ok !== true/);
  assert.match(close, /ACADEMIC_GRADES_INCOMPLETE/);
  assert.match(close, /const \{ matriculaId \} = await params/);
  assert.match(confirmedCurrent, /finalizar_rematricula_balcao/);
  assert.match(confirmedCurrent, /ENROLLMENT_RECEIPT_PENDING/);
});

test("enrollment listing exposes the official year id and pending reservations", () => {
  const list = readWeb("src/app/api/escolas/[id]/matriculas/route.ts");
  const view = readSql("20271029151000_enrollment_view_academic_year_ssot.sql");
  assert.match(view, /WITH \(security_invoker = true\)/);
  assert.match(view, /m\.session_id AS ano_letivo_id/);
  assert.doesNotMatch(view, /pl\.ano_letivo_id/);
  assert.match(list, /ano_letivo_id,\s*session_id,/);
  assert.match(list, /query = query\.eq\("status", "pendente"\)/);
  assert.match(list, /ano_letivo_id: row\.ano_letivo_id \?\? row\.session_id/);
  assert.doesNotMatch(list, /scope === "pending"\)[\s\S]{0,400}matriculas: \[\]/);
});
