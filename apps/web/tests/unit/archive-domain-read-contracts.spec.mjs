import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (path) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("all four historical records use the same authorized turma and academic session", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/registos/route.ts");
  assert.match(api, /z\.enum\(\["pautas", "horarios", "frequencia", "curriculo"\]\)/);
  assert.match(api, /z\.string\(\)\.uuid\(\)/);
  assert.match(api, /resolveEscolaIdForUser/);
  assert.match(api, /authorizeAcademicArchiveRead/);
  assert.match(api, /requestedAcademicYearId: ano_letivo_id/);
  assert.match(api, /year\.status !== "CLOSED"/);
  assert.match(api, /\.eq\("session_id", year\.id\)/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.match(api, /\.eq\("turma_id", turma\.id\)/);
  assert.match(api, /\.eq\("ano_letivo_id", year\.id\)/);
  assert.doesNotMatch(api, /\.(?:insert|update|upsert|delete)\(/);
  assert.match(api, /"Cache-Control": "private, no-store"/);
});

test("official historic pauta reads existing PDF with a fresh school-year authorization", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/pauta/[id]/route.ts");
  for (const check of [
    /authorizeAcademicArchiveRead/, /resolveEscolaIdForUser/, /requestedAcademicYearId/,
    /\.eq\("session_id", year\.id\)/, /\.eq\("ano_letivo_id", year\.id\)/,
    /pautaRes\.data\.status !== "SUCCESS"/, /createSignedUrl/, /if \(!period\)/,
  ]) assert.match(api, check);
  assert.doesNotMatch(api, /\.(?:insert|update|upsert|delete)\(/);
  assert.match(api, /createSignedUrl\(pautaRes\.data\.pdf_path, 60\)/);
});

test("timetable version is checked against the turma before loading slots and disciplines", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/registos/route.ts");
  assert.match(api, /\.in\("status", \["publicada", "arquivada"\]\)/);
  assert.match(api, /if \(versao_id && !selected\)/);
  assert.match(api, /\.eq\("versao_id", selected\.id\)/);
  assert.match(api, /\.from\("horario_slots"\)/);
  assert.match(api, /\.from\("disciplinas_catalogo"\)/);
});

test("attendance maps cannot silently truncate results or synthesize missing presence", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/registos/route.ts");
  assert.match(api, /\.from\("frequencia_status_periodo"\)/);
  assert.match(api, /for \(let page = 0; page < 20; page\+\+\)/);
  assert.match(api, /if \(!complete\) return failed/);
  assert.match(api, /if \(row\.abaixo_minimo === true\)/);
});

test("curricula only read versioned same-year matrices for selected class and course", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/registos/route.ts");
  assert.match(api, /\.from\("curso_curriculos"\)/);
  assert.match(api, /\.eq\("ano_letivo_id", year\.id\)\.eq\("classe_id", turma\.classe_id\)/);
  assert.match(api, /\.in\("curso_curriculo_id", ids\)/);
  assert.match(api, /\.from\("curso_matriz"\)/);
  assert.match(api, /if \(\(matrix \?\? \[\]\)\.length > 250\)/);
});

test("finance summary is a separate role-protected read and keeps older debts visible", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/financeiro/route.ts");
  assert.match(api, /requireRoleInSchool/);
  assert.match(api, /K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP/);
  assert.match(api, /vw_financeiro_propinas_mensal_escola/);
  assert.match(api, /limit\(501\)/);
  assert.match(api, /total_em_atraso_todos_anos: totalEmAtrasoTodosAnos/);
  assert.match(api, /mes: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(12\)\.optional\(\)/);
  assert.match(api, /competencia_selecionada: selectedMonth == null/);
  assert.doesNotMatch(api, /\.(?:insert|update|upsert|delete)\(/);
});

test("year comparison counts exact scoped records without cross-year or tenant fallback", () => {
  const api = src("app/api/secretaria/operacoes-academicas/arquivo/comparacao/route.ts");
  assert.match(api, /resolveEscolaIdForUser/);
  assert.match(api, /authorizeAcademicArchiveRead/);
  assert.match(api, /parsed\.data\.ano_letivo_id === parsed\.data\.comparar_ano_letivo_id/);
  assert.match(api, /\.eq\("escola_id", authorizedEscolaId\)\.eq\("session_id", year\.id\)/);
  assert.match(api, /count: "exact", head: true/);
  assert.match(api, /Matrículas sem session_id não são inferidas/);
  assert.match(api, /readVerifiedAcademicTrimesters/);
  assert.match(api, /requireVerifiedTrimester/);
  assert.match(api, /trimestre: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(3\)\.optional\(\)/);
  assert.match(api, /\.eq\("periodo_letivo_id", term\.id\)/);
  assert.doesNotMatch(api, /\.(?:insert|update|upsert|delete)\(/);
});

test("archive UI exposes contextual trimester and version choices without global year state", () => {
  const hub = src("components/academico/AcademicArchiveHub.tsx");
  const turma = src("components/academico/HistoricalTurmasPanel.tsx");
  const details = src("components/academico/ArchiveTurmaRecordsPanel.tsx");
  const analytics = src("components/academico/ArchiveAnalyticsPanel.tsx");
  assert.match(hub, /<ArchiveAnalyticsPanel/);
  assert.match(turma, /<ArchiveTurmaRecordsPanel/);
  assert.match(details, /periodFilter/);
  assert.match(details, /aria-pressed=\{type === id\}/);
  assert.match(details, /setVersionId\(event.target.value\)/);
  assert.match(details, /setPeriodFilter\(e.target.value\)/);
  assert.match(analytics, /total_em_atraso_todos_anos/);
  assert.match(analytics, /comparar_ano_letivo_id/);
  assert.match(analytics, /id="archive-report-period"/);
  assert.match(analytics, /id="archive-finance-month"/);
});

test("archive read roles resolve the actor's membership in the requested school", () => {
  const access = src("lib/academico/archive-read-authorization.ts");
  assert.match(access, /requireRoleInSchool/);
  assert.match(access, /K12_ADMIN_SECRETARIA_ROLE_GROUP/);
  assert.match(access, /"diretor", "secretaria_financeiro", "admin_secretario"/);
  assert.match(access, /supabase, escolaId/);
});
