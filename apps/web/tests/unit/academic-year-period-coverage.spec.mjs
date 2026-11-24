import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (name) => readFileSync(resolve(process.cwd(), "src", name), "utf8");

test("official document batch refuses a trimester from a different year or school before job creation", () => {
  const route = src("app/api/secretaria/documentos-oficiais/lote/route.ts");
  assert.match(route, /readVerifiedAcademicTrimesters/);
  assert.match(route, /requireVerifiedTrimester\(verified, \{ id: effectivePeriodoLetivoId \}\)/);
  assert.match(route, /anoLetivoId: academicContext\.anoLetivoId/);
  assert.match(route, /CanonicalPeriodReadError/);
  assert.match(route, /\.eq\("id", effectivePeriodoLetivoId\)/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("ano_letivo_id", academicContext\.anoLetivoId\)/);
  const guardPosition = route.indexOf("if (effectivePeriodoLetivoId) {");
  const jobPosition = route.indexOf(".from(\"pautas_lote_jobs\")\n      .insert(");
  assert.ok(guardPosition >= 0 && jobPosition > guardPosition,
    "verify period before inserting official publication job");
});

test("legacy timetable version GET cannot create a draft in an archived or planned year", () => {
  const route = src("app/api/secretaria/turmas/[id]/horario/versao/route.ts");
  assert.match(route, /resolveAcademicYearScope/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("id", turmaId\)/);
  assert.match(route, /requestedAcademicYearId: turma\.session_id/);
  assert.match(route, /requestedYearId !== year\.id/);
  assert.match(route, /if \(!publicada && !draft && year\.status === "ACTIVE"\)/);
  assert.match(route, /year\.status === "ACTIVE" \? \(draft\?\.id \?\? null\) : null/);
  assert.match(route, /"HISTORICAL_READ"/);
});

for (const type of ["resumo", "propinas"]) {
  test("financial " + type + " rejects unknown and conflicting years without using the civil year", () => {
    const route = src("app/api/financeiro/relatorios/" + type + "/route.ts");
    assert.match(route, /ACADEMIC_YEAR_NOT_FOUND/);
    assert.match(route, /CROSS_YEAR_FILTER_MISMATCH/);
    assert.match(route, /ACADEMIC_YEAR_INVALID/);
    assert.match(route, /const anoLetivo = anoScope\.ano/);
    assert.doesNotMatch(route, /anoScope\?\.ano \?\? new Date\(\)\.getFullYear\(\)/);
  });
}

test("professor and secretariat year-specific period readers retain canonical validation", () => {
  const professor = src("app/api/professor/periodos/route.ts");
  const relatorio = src("app/api/secretaria/relatorios/mapa-aproveitamento/route.ts");
  assert.match(professor, /verifyCanonicalPeriodsRead/);
  assert.match(professor, /\.eq\('ano_letivo_id', academicContext\.anoLetivoId\)/);
  assert.match(relatorio, /readVerifiedAcademicTrimesters/);
  assert.match(relatorio, /requireVerifiedTrimester/);
});

test("historical attendance supports local trimester selection without changing other modules", () => {
  const panel = src("components/academico/ArchiveTurmaRecordsPanel.tsx");
  assert.match(panel, /id=\{"archive-attendance-period-" \+ turmaId\}/);
  assert.match(panel, /periodo\.id === periodFilter|f\.periodo_letivo_id === periodFilter/);
  assert.match(panel, /setPeriodFilter\(event\.target\.value\)/);
  assert.match(panel, /<option value="">Todos os trimestres<\/option>/);
});
