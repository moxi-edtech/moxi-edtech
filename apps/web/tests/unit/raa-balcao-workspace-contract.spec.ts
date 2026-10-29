import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("Rematrícula uses the origin enrollment from the server, not the dossier's current enrollment", () => {
  const api = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  const gradeModal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(api, /source:\s*\{\s*matricula_id:\s*matriculaOrigem\.id/);
  assert.match(api, /ano_letivo_id:\s*matriculaOrigem\.session_id/);
  assert.match(workspace, /raaMatriculaId=\{rematricula\.academic\?\.source\?\.matricula_id \?\? null\}/);
  assert.doesNotMatch(workspace, /raaMatriculaId=\{dossier\.aluno\.matricula_id/);
  assert.match(workspace, /originAnoLetivoId:\s*source\.ano_letivo_id/);
  assert.match(gradeModal, /setAcademicYearId\(originAnoLetivoId\)/);
});

test("Documents are emitted/charged inside Rematrícula with the existing checkout", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /if \(view === "reenrollment"\) setRaaDocumentsOpen\(true\)/);
  assert.match(workspace, /data-balcao-action="document"/);
  assert.match(workspace, /data-balcao-raa-documents/);
  assert.match(workspace, /if \(paid\) void onAdicionarServico\(servico\); else void onEmitirDocumento\(servico\)/);
  assert.match(workspace, /view === "reenrollment" && raaDocumentsOpen && selectedItemKeys\.size > 0/);
  assert.match(workspace, /onCloseRaaDocuments=\{\(\) => setRaaDocumentsOpen\(false\)\}/);
});

test("Exams display previously submitted components and preserve writer idempotency", () => {
  const api = source("app/api/secretaria/balcao/raa/exam-context/route.ts");
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  assert.match(api, /from\("exame_resultados"\)/);
  assert.match(api, /eq\("matricula_id", matricula\.id\)/);
  assert.match(panel, /previousExamResult/);
  assert.match(panel, /Boolean\(previousExamResult\)/);
  assert.match(panel, /await refreshAfterSave\(\)/);
  assert.match(panel, /A refresh error must never make it/);
});

test("Old academic decisions cannot be overwritten by a client-only remission", () => {
  const panel = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  assert.match(panel, /await readJson\("\/api\/academico\/exames\/resultados"/);
  assert.match(panel, /await onRecheck\(\)/);
  assert.match(status, /academicEligibility = classifyRematriculaAcademicEligibility/);
});

test("Grade entry does not carry a trimester, grade or discipline across student contexts", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  const periods = source("app/api/secretaria/notas/periodos/route.ts");
  assert.match(modal, /useState\(""\)/);
  assert.doesNotMatch(modal, /useState\("1"\)/);
  assert.match(modal, /setPeriodo\(""\)/);
  assert.match(modal, /setNota\(""\)/);
  assert.match(modal, /\[action, alunoId, escolaId, turmaId, originAnoLetivoId, open\]/);
  assert.match(modal, /\/api\/secretaria\/notas\/periodos\?/);
  assert.match(modal, /item\.numero === payload\.current_trimestre/);
  assert.match(periods, /await assertAcademicYearEntity/);
  assert.match(periods, /new Set\(periods\.map/);
  assert.match(periods, /read_only: context\.mode !== "CURRENT"/);
});

test("Trimesters are validated in API and SQL, not only by the Balcao UI", () => {
  const api = source("app/api/secretaria/notas/route.ts");
  const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271029235921_guard_grade_period_source_and_window.sql"), "utf8");
  assert.match(api, /gradePeriodState\(candidatePeriods\[0\]\)/);
  assert.match(api, /GRADE_PERIOD_NOT_AVAILABLE/);
  assert.match(sql, /WHERE al\.id = v_turma\.session_id/);
  assert.doesNotMatch(sql, /AND al\.ativo = true/);
  assert.match(sql, /m\.session_id = v_turma\.session_id/);
  assert.match(sql, /m\.ativo = true/);
  assert.match(sql, /v_today > v\.ends/);
  assert.match(sql, /public\.current_tenant_escola_id\(\)/);
  assert.match(sql, /v_nota_max := 10/);
  assert.match(sql, /v_nota_max := 20/);
  assert.match(sql, /can_bypass_pauta_lock/);
  assert.match(sql, /matricula_year_id IS DISTINCT FROM v\.turma_year_id/);
});

test("The official template must be propagated with source provenance and pilot reconciliation stays explicit", () => {
  const importer = source("app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts");
  const sql = readFileSync(resolve(process.cwd(), "../../supabase/ops/reconcile_klasse_school_2026_2027_calendar.sql"), "utf8");
  assert.match(importer, /source_template_id: periodTemplate\.id/);
  assert.match(importer, /source_item_id: item\.id/);
  assert.match(sql, /current_setting\('klasse\.approve_calendar_2026_2027', true\)/);
  assert.match(sql, /WHERE id=v_year_id AND escola_id=v_school_id/);
  assert.match(sql, /source_item_id=i\.id/);
});

test("Official 2026 calendar cannot be replaced via legacy or unaudited routes", () => {
  const template = source("app/api/escola/[id]/admin/calendario/aplicar-template/route.ts");
  const ajustes = source("app/api/escola/[id]/admin/calendario/ajustes/route.ts");
  const legacy = source("app/api/escola/[id]/admin/periodos-letivos/upsert-bulk/route.ts");
  assert.match(template, /source_template_id: template\.id/);
  assert.match(template, /ACADEMIC_YEAR_CALENDAR_MISMATCH/);
  assert.match(template, /ACADEMIC_PERIOD_LOCK_REVIEW_REQUIRED/);
  assert.match(ajustes, /validateOfficialCalendarAdjustment/);
  const guard = source("lib/academico/official-calendar-write-guard.ts");
  assert.match(guard, /OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION/);
  assert.match(guard, /CALENDAR_LOCK_CHANGE_REASON_REQUIRED/);
  assert.match(ajustes, /roles: \["admin", "admin_escola", "diretor"\]/);
  assert.match(legacy, /OFFICIAL_CALENDAR_CONTROLLED_WRITE_REQUIRED/);
  assert.doesNotMatch(legacy, /stack: e instanceof Error/);
});

test("Disciplinas com trimestres específicos não aceitam lançamento fora da oferta", () => {
  const periodos = source("app/api/secretaria/notas/periodos/route.ts");
  const notas = source("app/api/secretaria/notas/route.ts");
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271029235921_guard_grade_period_source_and_window.sql"), "utf8");
  assert.match(periodos, /turma_disciplina_id: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(periodos, /disciplina_ativa: activePeriods === null/);
  assert.match(notas, /GRADE_DISCIPLINE_INACTIVE_TRIMESTER/);
  assert.match(modal, /!item\.disciplina_ativa/);
  assert.match(sql, /cardinality\(v_turma_disciplina\.periodos_ativos\)/);
  assert.match(sql, /p_trimestre = ANY\(v_turma_disciplina\.periodos_ativos\)/);
});

test("Legacy onboarding and calendar copy cannot override official 2026/27 timelines", () => {
  const onboarding = source("app/api/escolas/[id]/onboarding/core/session/route.ts");
  const rotate = source("app/api/escolas/[id]/onboarding/session/rotate/route.ts");
  const copy = source("app/api/escola/[id]/admin/calendario/copiar-eventos/route.ts");
  const template = source("app/api/escola/[id]/admin/calendario/aplicar-template/route.ts");
  const legacy = source("app/api/escola/[id]/admin/periodos-letivos/upsert-bulk/route.ts");
  assert.match(onboarding, /ACADEMIC_CALENDAR_TEMPLATE_MISMATCH/);
  assert.match(onboarding, /MULTI_OFFERING_CALENDAR_REQUIRES_SCOPED_IMPORT/);
  assert.match(onboarding, /source_item_id: i.id/);
  assert.match(onboarding, /source_version: officialVersion/);
  assert.match(rotate, /requestedYear >= 2026/);
  assert.match(rotate, /OFFICIAL_CALENDAR_CONTROLLED_WRITE_REQUIRED/);
  assert.match(copy, /OFFICIAL_CALENDAR_COPY_NOT_ALLOWED/);
  assert.match(copy, /\.eq\('escola_id', userEscolaId\)/);
  assert.match(template, /OFFICIAL_CALENDAR_PERIODS_INCOMPLETE/);
  assert.match(template, /MULTI_OFFERING_CALENDAR_REQUIRES_SCOPED_IMPORT/);
  assert.match(legacy, /\.min\(1\)\.max\(20\)/);
});

test("The database protects official periods and published MED events from direct writes", () => {
  const migration = readFileSync(resolve(process.cwd(),
    "../../supabase/migrations/20271029235921_guard_grade_period_source_and_window.sql"), "utf8");
  const regression = readFileSync(resolve(process.cwd(),
    "../../supabase/ops/tests/regression_grade_period_guard.sql"), "utf8");
  assert.match(migration, /CREATE TRIGGER trg_guard_official_grade_period_write/);
  assert.match(migration, /OFFICIAL_CALENDAR_SOURCE_MISMATCH/);
  assert.match(migration, /CREATE TRIGGER trg_guard_official_calendar_event_write/);
  assert.match(migration, /OFFICIAL_CALENDAR_EVENT_LOCKED/);
  assert.match(regression, /TEST: published exam was deleted/);
  assert.match(regression, /TEST: a divergent academic period was accepted/);
});

test("The year-turn API rejects contradictory official templates before creating sessions", () => {
  const route = source("app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts");
  assert.match(route, /ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE/);
  assert.match(route, /canonicalPeriodKey/);
  assert.match(route, /ACADEMIC_YEAR_CALENDAR_MISMATCH/);
  assert.ok(route.indexOf("ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE") <
    route.indexOf("setup_active_ano_letivo"));
  assert.ok(route.indexOf('rpc("upsert_bulk_periodos_letivos"') <
    route.indexOf("Publish the profile mapping only after"));
});

test("Administrative calendar UI avoids accidental edits to national events", () => {
  const page = source("app/escola/[id]/(portal)/admin/configuracoes/calendario/page.tsx");
  assert.match(page, /anoNum >= 2026/);
  assert.ok(page.includes("selected?.source_template_id"));
  assert.match(page, /EVENTO_ESCOLA/);
  assert.match(page, /Provas, exames e pausas oficiais/);
});
