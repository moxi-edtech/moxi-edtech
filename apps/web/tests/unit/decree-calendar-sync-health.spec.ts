import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditDecreeSync, type DecreeSyncSnapshot } from "../../src/lib/academic-calendar/decree-sync-health";
import { selectApplicableOfficialEvents } from "../../src/lib/academic-calendar/visible-official-events";

function fixture(): DecreeSyncSnapshot {
  const templateId = "model-regular-2026";
  const yearId = "year-2026";
  const officialItems = [
    { id: "trimestre-1", nome: "I Trimestre", tipo: "PERIODO_LETIVO", numero: 1, data_inicio: "2026-09-01", data_fim: "2026-12-18" },
    { id: "trimestre-2", nome: "II Trimestre", tipo: "PERIODO_LETIVO", numero: 2, data_inicio: "2027-01-04", data_fim: "2027-04-09" },
    { id: "trimestre-3", nome: "III Trimestre", tipo: "PERIODO_LETIVO", numero: 3, data_inicio: "2027-04-26", data_fim: "2027-06-18" },
    { id: "prova-1", nome: "Provas do I Trimestre", tipo: "PROVA_TRIMESTRAL", data_inicio: "2026-12-09", data_fim: "2026-12-18" },
  ];
  return {
    year: { id: yearId, ano: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31" },
    offerings: [{ id: "offer-primary", education_subsystem: "REGULAR_ADULTOS", calendar_profile_id: templateId }],
    templates: [{
      id: templateId, ano_base: 2026, subsistema: "REGULAR_ADULTOS", estado: "PUBLICADO", is_oficial: true,
      data_inicio: "2026-09-01", data_fim: "2027-08-31",
      versao_documento: "FINAL-ACTUALIZADO",
      fonte_referencia: "Decreto do Ministério da Educação", fonte_documento_url: "https://example.org/official",
      items: officialItems,
    }],
    periods: officialItems.filter((item) => item.tipo === "PERIODO_LETIVO").map((item) => ({
      id: item.id, numero: item.numero!, tipo: "TRIMESTRE", data_inicio: item.data_inicio, data_fim: item.data_fim,
      offering_id: null, source_template_id: templateId, source_item_id: item.id, source_version: "FINAL-ACTUALIZADO",
    })),
    events: [{
      id: "evt-prova", nome: "Provas do I Trimestre", tipo: "PROVA_TRIMESTRAL",
      data_inicio: "2026-12-09", data_fim: "2026-12-18",
      offering_id: null, source_template_id: templateId, source_item_id: "prova-1", source_version: "FINAL-ACTUALIZADO",
    }],
  };
}

test("2026/2027 fully inherited from published decree is healthy", () => {
  const result = auditDecreeSync(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.expected_event_count, 1);
  assert.equal(result.expected_trimesters, 3);
});

test("school 2026/2027 with an August start, divergent trimesters and absent exams is blocked", () => {
  const data = fixture();
  data.year!.data_inicio = "2026-08-01";
  data.year!.data_fim = "2027-07-31";
  data.periods[0].data_inicio = "2026-08-01";
  data.events = [];
  const result = auditDecreeSync(data);
  assert.equal(result.ok, false);
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes("YEAR_RANGE_MISMATCH"));
  assert.ok(codes.includes("TRIMESTER_DATES_MISMATCH"));
  assert.ok(codes.includes("EXAM_EVENT_MISSING"));
});

test("period lineage missing is separately reported, without claiming dates have changed", () => {
  const data = fixture();
  data.periods.forEach((period) => {
    period.source_item_id = null;
    period.source_template_id = null;
    period.source_version = null;
  });
  const result = auditDecreeSync(data);
  assert.equal(result.ok, true);
  assert.ok(result.issues.some((issue) => issue.code === "TRIMESTER_SOURCE_MISSING" && issue.severity === "warning"));
  assert.ok(!result.issues.some((issue) => issue.code === "TRIMESTER_DATES_MISMATCH"));
});

test("mismatched, unofficial and cross-subsystem templates cannot be considered synchronized", () => {
  const data = fixture();
  data.templates[0].subsistema = "TECNICO_PROFISSIONAL";
  assert.equal(auditDecreeSync(data).ok, false);
  data.templates[0].subsistema = "REGULAR_ADULTOS";
  data.templates[0].is_oficial = false;
  assert.equal(auditDecreeSync(data).ok, false);
  data.templates[0].is_oficial = true;
  data.templates[0].estado = "RASCUNHO";
  assert.equal(auditDecreeSync(data).ok, false);
});

test("health endpoint has auth, school authorization and is read-only", () => {
  const source = readFileSync("src/app/api/secretaria/operacoes-academicas/calendario/decreto-health/route.ts", "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /resolveEscolaIdForUser/);
  assert.match(source, /requireRoleInSchool/);
  assert.match(source, /auditDecreeSync/);
  assert.doesNotMatch(source, /\.(insert|upsert|update|delete|rpc)\(/);
});

test("official year preparation persists template/item/version, and refuses editing active sessions", () => {
  const route = readFileSync("src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts", "utf8");
  assert.match(route, /source_template_id: periodTemplate\.id/);
  assert.match(route, /source_item_id: item\.id/);
  assert.match(route, /source_version: periodTemplate\.versao_documento/);
  assert.match(route, /CALENDAR_PROVENANCE_NOT_PERSISTED/);
  assert.match(route, /ACTIVE_YEAR_RECONCILIATION_REQUIRED/);
  assert.match(route, /CALENDAR_PROFILES_CONFLICT/);
});

test("legacy template application cannot overwrite active multi-offering schools silently", () => {
  const route = readFileSync("src/app/api/escola/[id]/admin/calendario/aplicar-template/route.ts", "utf8");
  assert.match(route, /CALENDAR_MULTI_OFFERING_REQUIRED/);
  assert.match(route, /ACTIVE_YEAR_RECONCILIATION_REQUIRED/);
  assert.match(route, /\.eq\('is_oficial', true\)/);
  assert.match(route, /\.eq\('estado', 'PUBLICADO'\)/);
  assert.match(route, /source_item_id: i\.id/);
});

test("calendar provenance RPC accepts legacy 2025 only in the absence of period items", () => {
  const sql = readFileSync("../../supabase/migrations/20261029181554_preserve_legacy_2025_calendar_provenance_compatibility.sql", "utf8");
  assert.match(sql, /t\.ano_base < 2026/);
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /i\.tipo::text = 'PERIODO_LETIVO'/);
  assert.match(sql, /v_has_permission/);
  assert.match(sql, /current_tenant_escola_id/);
});

test("admission conversion rejects misaligned 2026/27 decree before financial writes", () => {
  const source = readFileSync("src/app/api/secretaria/admissoes/convert/route.ts", "utf8");
  assert.match(source, /inspectDecreeSync\(supabase as any, escolaId, targetTurma\.ano_letivo\)/);
  assert.match(source, /targetTurma\.ano_letivo >= 2026/);
  assert.match(source, /ACADEMIC_CALENDAR_YEAR_MISMATCH/);
  assert.match(source, /ACADEMIC_CALENDAR_NOT_CONFIGURED/);
  const preflight = source.indexOf("const decreeHealth = await inspectDecreeSync");
  const canonicalRpc = source.indexOf("supabase.rpc('admissao_finalizar_matricula'");
  assert.ok(preflight > 0);
  assert.ok(canonicalRpc > preflight, "preflight must precede the enrollment/financial transaction");
});

test("tampered source references fail even when trimester/exam dates look correct", () => {
  const data = fixture();
  data.periods[0].source_item_id = "unrelated-item";
  data.events[0].source_version = "OLDER-VERSION";
  const report = auditDecreeSync(data);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "TRIMESTER_SOURCE_MISMATCH"));
  assert.ok(report.issues.some((issue) => issue.code === "OFFICIAL_EVENT_SOURCE_MISMATCH"));
});

test("student calendar is scoped by authorized pupil, active enrollment year and school profile", () => {
  const source = readFileSync("src/app/api/aluno/home/academic-events/route.ts", "utf8");
  assert.match(source, /getAlunoContext\(\)/);
  assert.match(source, /resolveSelectedStudentId/);
  assert.match(source, /authorizedIds: ctx\.alunoIds/);
  assert.match(source, /from\("matriculas"\)/);
  assert.match(source, /\.eq\("ano_letivo", activeYear\.ano\)/);
  assert.match(source, /\.in\("status", ACTIVE_MATRICULA_STATUSES\)/);
  assert.match(source, /\.eq\("course_id", turma\.curso_id\)/);
  assert.match(source, /selectApplicableOfficialEvents/);
  assert.match(source, /from\("calendario_template_items"\)/);
  assert.match(source, /\.in\("template_id", templateIds\)/);
  assert.match(source, /\.eq\("ano_letivo_id", activeYear\.id\)/);
  assert.match(source, /timeZone: "Africa\/Luanda"/);
});

test("teacher calendar isolates school events from the selected academic year", () => {
  const source = readFileSync("src/app/api/professor/calendario/route.ts", "utf8");
  assert.match(source, /resolveAcademicYearContext/);
  assert.match(source, /from\("vw_eventos_escola_unificados"\)/);
  assert.match(source, /\.eq\("tipo", "EVENTO_GERAL"\)/);
  assert.match(source, /from\("calendario_eventos"\)/);
  assert.match(source, /\.eq\("ano_letivo_id", anoLetivo\.id\)/);
  assert.match(source, /\.eq\("escola_id", escolaId\)/);
  assert.match(source, /items: calendarItems/);
});

test("other period and calendar readers use the same academic year and turma context", () => {
  const sources = [
    "src/app/api/secretaria/calendario/route.ts",
    "src/app/api/escola/[id]/admin/periodos-por-turma/route.ts",
    "src/app/api/professor/periodos/route.ts",
    "src/app/api/escola/[id]/admin/periodos-letivos/route.ts",
    "src/app/api/secretaria/turmas/[id]/pauta-trimestral/route.ts",
  ];
  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /resolveAcademicYearContext/, path);
    assert.match(source, /ano_letivo_id/, path);
  }
});

test("shared MED events are visible across subsystems even when stored under one source profile", () => {
  const items = [
    { tipo: "FERIADO", nome: "Dia nacional", data_inicio: "2026-11-11", data_fim: "2026-11-11", applies_to_all_offerings: true },
    { tipo: "PROVA_TRIMESTRAL", nome: "Prova do primeiro trimestre", data_inicio: "2026-12-09", data_fim: "2026-12-18", applies_to_all_offerings: true },
  ];
  const events = [
    { id: "shared-preschool", tipo: "FERIADO", nome: "Dia nacional", data_inicio: "2026-11-11", data_fim: "2026-11-11", offering_id: null, source_template_id: "preschool" },
    { id: "regular-prova", tipo: "PROVA_TRIMESTRAL", nome: "Prova do primeiro trimestre", data_inicio: "2026-12-09", data_fim: "2026-12-18", offering_id: null, source_template_id: "regular" },
    { id: "other", tipo: "EXAME_ESCRITO", nome: "Exame especial", data_inicio: "2027-06-21", data_fim: "2027-07-02", offering_id: null, source_template_id: "regular" },
  ];
  const selected = selectApplicableOfficialEvents(events, items, ["primary"]);
  assert.deepEqual(selected.map((event) => event.id), ["shared-preschool", "regular-prova"]);
});

test("grade-restricted and offering-specific events are not leaked to unrelated pupils", () => {
  const items = [
    { tipo: "EXAME_ESCRITO", nome: "Prova final", data_inicio: "2027-06-21", data_fim: "2027-07-02", grade_codes: ["9"] },
    { tipo: "EVENTO_ESCOLA", nome: "Atividade de curso", data_inicio: "2027-01-05", data_fim: "2027-01-05", applies_to_all_offerings: false },
  ];
  const events = [
    { id: "exam", nome: "Prova final", tipo: "EXAME_ESCRITO", data_inicio: "2027-06-21", data_fim: "2027-07-02", offering_id: null },
    { id: "course", nome: "Atividade de curso", tipo: "EVENTO_ESCOLA", data_inicio: "2027-01-05", data_fim: "2027-01-05", offering_id: "offer-a" },
  ];
  assert.deepEqual(selectApplicableOfficialEvents(events, items, ["offer-b"], "8"), []);
  assert.deepEqual(selectApplicableOfficialEvents(events, items, ["offer-a"], "9").map((item) => item.id), ["exam", "course"]);
});

test("national exams without grade metadata are shown only for documented examination classes", () => {
  const exams = [{
    id: "national-exam", nome: "Exame nacional", tipo: "EXAME_ESCRITO",
    data_inicio: "2027-06-21", data_fim: "2027-07-02", offering_id: null,
  }];
  const items = [{
    nome: "Exame nacional", tipo: "EXAME_ESCRITO",
    data_inicio: "2027-06-21", data_fim: "2027-07-02",
    grade_codes: [],
  }];
  assert.equal(selectApplicableOfficialEvents(exams, items, ["regular"], "8", false).length, 0);
  assert.equal(selectApplicableOfficialEvents(exams, items, ["regular"], "9", true).length, 1);
});

test("student endpoint checks turma exam-class source before publishing national exam dates", () => {
  const source = readFileSync("src/app/api/aluno/home/academic-events/route.ts", "utf8");
  assert.match(source, /turmas!inner\(id,curso_id,classe_num,is_classe_exame\)/);
  assert.match(source, /turma\.is_classe_exame === true/);
});

test("quarterly report cannot expose a period not present in its official academic year", () => {
  const source = readFileSync("src/app/api/secretaria/turmas/[id]/pauta-trimestral/route.ts", "utf8");
  assert.match(source, /assertAcademicYearEntity/);
  assert.match(source, /\.eq\('ano_letivo_id', academicContext\.anoLetivoId\)/);
  assert.match(source, /ACADEMIC_PERIOD_NOT_CONFIGURED/);
  assert.match(source, /periodosRows \?\? \[\]/);
});
