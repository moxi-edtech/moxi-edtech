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

test("Legacy mixed-subsystem reconciliation cannot replace per-course official events", () => {
  const old = readFileSync(resolve(process.cwd(),
    "../../supabase/ops/reconcile_klasse_school_2026_2027_calendar.sql"), "utf8");
  const audit = readFileSync(resolve(process.cwd(),
    "../../supabase/ops/audit_klasse_2026_2027_course_calendars.sql"), "utf8");
  assert.match(old, /COURSE_CALENDAR_RECONCILIATION_REQUIRED/);
  assert.match(old, /o.education_subsystem <> 'REGULAR_ADULTOS'/);
  assert.match(audit, /periodo_sincronizado_med/);
  assert.match(audit, /PERFIL_COMPATIVEL/);
  assert.match(audit, /ev.offering_id/);
  assert.doesNotMatch(audit, /\b(UPDATE|DELETE|INSERT)\s+(?:INTO|FROM|public\.)/i);
});

test("All direct MED trimester endpoints use the same provenance guard and typed 409", () => {
  const endpoints = [
    "app/api/professor/calendario/route.ts",
    "app/api/professor/periodos/route.ts",
    "app/api/secretaria/notas/periodos/route.ts",
    "app/api/escola/[id]/admin/periodos-letivos/route.ts",
    "app/api/escola/[id]/admin/periodos-por-turma/route.ts",
  ];
  for (const endpoint of endpoints) {
    const route = read(endpoint);
    assert.match(route, /verifyCanonicalPeriodsRead/);
    assert.match(route, /CanonicalPeriodReadError/);
    assert.match(route, /source_version/);
    assert.match(route, /source_item_id/);
    assert.match(route, /anoLetivoId: .*anoLetivoId/);
  }
});

test("Indirect calendar consumers use the scoped MED trimester reader", () => {
  const consumers = [
    "app/api/secretaria/turmas/[id]/mini-pauta/route.ts",
    "app/api/secretaria/turmas/[id]/pauta-trimestral/route.ts",
    "app/api/secretaria/turmas/[id]/pauta-geral/route.ts",
    "app/api/secretaria/turmas/[id]/pauta-geral/oficial/route.ts",
    "app/api/secretaria/turmas/[id]/disciplinas/route.ts",
    "app/api/secretaria/relatorios/mapa-aproveitamento/route.ts",
    "app/api/professor/presencas/route.ts",
    "app/api/escola/[id]/admin/frequencias/fechar-periodo/route.ts",
    "app/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote/route.ts",
    "app/api/secretaria/operacoes-academicas/virada/pautas-status/route.ts",
    "app/api/secretaria/fechamento-academico/validacoes/engine.ts",
  ];
  for (const path of consumers) {
    assert.match(read(path), /readVerifiedAcademicTrimesters/, path);
  }
  const attendance = read("app/api/professor/presencas/route.ts");
  assert.match(attendance, /verifiedTrimesterForDate/);
  assert.match(attendance, /idempotencyReserved/);
  assert.match(read("app/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote/route.ts"),
    /requireVerifiedTrimester\(verifiedPeriods, \{ numero: 3 \}\)/);
  const report = read("app/api/secretaria/relatorios/mapa-aproveitamento/route.ts");
  assert.match(report, /session_id", academicContext\.anoLetivoId/);
  assert.match(report, /requireVerifiedTrimester\(periodos, \{ id: periodoId \}\)/);
  const annualClose = read("app/api/secretaria/fechamento-academico/validacoes/engine.ts");
  assert.match(annualClose, /requireVerifiedTrimester\(verifiedPeriods/);
});
