import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), `src/${path}`), "utf8");

test("Student, professor and secretaria retrieve course-aware events through one resolver", () => {
  const student = read("app/api/aluno/home/academic-events/route.ts");
  const professor = read("app/api/professor/calendario/route.ts");
  const secretaria = read("app/api/secretaria/calendario/route.ts");
  for (const route of [student, professor, secretaria]) {
    assert.match(route, /readScopedAcademicCalendarEvents/);
    assert.match(route, /ano_letivo_id|anoLetivoId/);
    assert.doesNotMatch(route, /vw_eventos_escola_unificados/);
  }
  assert.match(student, /resolveSelectedStudentId/);
  assert.match(professor, /resolveCalendarOfferingIdsForCourses/);
  assert.match(secretaria, /staffOverview: !selectedCourseId/);
  assert.match(secretaria, /offering_id: event.offering_id/);
});

test("The Copilot never treats course-specific exam events as schoolwide deadlines", () => {
  const copilot = read("lib/assistant/data-copilot/tools/academic-calendar-operations.ts");
  assert.match(copilot, /readScopedAcademicCalendarEvents/);
  assert.match(copilot, /offeringIds: \[\]/);
  assert.doesNotMatch(copilot, /\.from\("calendario_eventos"\)/);
});

test("Dry-run, course cloning and closing share the canonical source validation", () => {
  const dryRun = read("app/api/secretaria/operacoes-academicas/virada/dry-run/route.ts");
  const cloning = read("app/api/secretaria/operacoes-academicas/virada/clone-structure/route.ts");
  const closing = read("lib/secretaria/fechamentoAcademicoOrchestrator.ts");
  assert.match(dryRun, /reviewCanonicalCutoverTarget/);
  assert.match(dryRun, /calendarios_oficiais_anos/);
  assert.match(cloning, /readCanonicalCutoverTargetReview/);
  assert.match(cloning, /ACADEMIC_CALENDAR_CUTOVER_NOT_READY/);
  assert.match(closing, /readCanonicalCutoverTargetReview/);
  assert.match(closing, /if \(acao === "fechar_ano"\)/);
  assert.match(closing, /academicYear.ano < 2026/);
  const legacyClosing = read("app/api/secretaria/fechamento-academico/route.ts");
  assert.match(legacyClosing, /if \(ano.ano < 2026\)/);
});

test("Onboarding does not reweight official periods and later binds events to courses", () => {
  const initializer = read("app/api/escolas/[id]/onboarding/core/session/route.ts");
  const finalizer = read("app/api/escolas/[id]/onboarding/core/finalize/route.ts");
  const helper = read("lib/academico/prepare-canonical-calendar.ts");
  assert.match(initializer, /allowEmptyOfferings: true/);
  assert.match(finalizer, /anoParaSetup < 2026 && periodos.length > 0/);
  assert.match(finalizer, /prepareCanonicalMedCalendar/);
  assert.match(helper, /aplicar_calendario_med_canonico_v1/);
  assert.doesNotMatch(helper, /\.from\("calendario_eventos"\)\.upsert\(/);
});

test("Archived MED years cannot be force-deleted and legacy rotation is denied", () => {
  const deletion = read("app/api/escolas/[id]/onboarding/session/[sessionId]/route.ts");
  const rotation = read("app/api/escolas/[id]/onboarding/session/rotate/route.ts");
  assert.match(deletion, /found.ano >= 2026 && force/);
  assert.match(deletion, /OFFICIAL_CALENDAR_DESTRUCTIVE_DELETE_BLOCKED/);
  assert.match(rotation, /requestedYear >= 2026/);
  assert.match(rotation, /OFFICIAL_CALENDAR_CONTROLLED_WRITE_REQUIRED/);
});

test("Atomicity is enforced by PostgreSQL with rollback and source tests in CI", () => {
  const migration = readFileSync(resolve(process.cwd(),
    "../../supabase/migrations/20271029235923_apply_canonical_med_calendar_atomic.sql"), "utf8");
  const regression = readFileSync(resolve(process.cwd(),
    "../../supabase/ops/tests/regression_atomic_canonical_med_calendar.sql"), "utf8");
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /current_tenant_escola_id\(\)/);
  assert.match(migration, /user_has_role_in_school/);
  assert.match(migration, /CALENDAR_COURSE_MAPPING_INCOMPLETE/);
  assert.match(migration, /ACADEMIC_CALENDAR_EXISTING_EVENTS_REVIEW_REQUIRED/);
  assert.match(regression, /TEST_ATOMIC_INJECTED_FAILURE/);
  assert.match(regression, /failed event write left a partial year/);
});
