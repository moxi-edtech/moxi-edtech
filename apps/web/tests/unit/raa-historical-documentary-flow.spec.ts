import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");
const migration = read("../../../../supabase/migrations/20271109010000_raa_historico_documental_ratificado.sql");
const route = read("../../src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
const ui = read("../../src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx");
const balc = read("../../src/components/secretaria/BalcaoAtendimento.tsx");
const status = read("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts");
const rematricula = read("../../src/app/api/secretaria/balcao/rematriculas/route.ts");
const finalizacao = read("../../../../supabase/migrations/20271109020000_rematricula_preserva_origem_legal_fechada.sql");

test("a coorte alone never authorizes reenrollment without signed documentary evidence", () => {
  assert.match(migration, /h\.snapshot_status='fechado'/);
  assert.match(migration, /c\.modo='virada_assistida_sem_notas'/);
  assert.match(migration, /a\.details->>'ratificacao'='true'/);
  assert.match(migration, /a\.details->>'papel_autorizado' IN/);
  assert.match(migration, /sl\.historico_ano_id=h\.id/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM public\.notas/);
  assert.match(migration, /'fonte_decisao','historico_documental_ratificado'/);
});

test("RAA historical approval, retention and completion have distinct destination contracts", () => {
  assert.match(migration, /WHEN 'aprovado' THEN 'transitou'/);
  assert.match(migration, /WHEN 'reprovado' THEN 'retido'/);
  assert.match(migration, /WHEN 'aprovado' THEN 'proxima_etapa'/);
  assert.match(migration, /WHEN 'reprovado' THEN 'mesma_etapa'/);
  assert.match(migration, /ELSE 'conclusao' END/);
  assert.match(rematricula, /resultadoEsperado: academicEligibility\.mode === "repeat" \? "reprovado" : "aprovado"/);
  assert.match(rematricula, /history\?\.snapshot_status === "fechado"/);
  assert.doesNotMatch(rematricula, /p_resultado_final:\s*"aprovado"/);
});

test("only exact academic director roles can sign a historical grade-less outcome", () => {
  assert.match(route, /ExactHistoricalDecisionRoles/);
  assert.match(route, /\.from\("escola_users"\)/);
  assert.match(route, /canWriteHistoricalDecision\(supabase, escolaId\)/);
  assert.match(migration, /eu\.papel IN \('admin','admin_escola','staff_admin','diretor'\)/);
  assert.match(migration, /HISTORICAL_SNAPSHOT_AUTH_FORBIDDEN/);
  assert.match(migration, /ACADEMIC_DOCUMENT_GRADES_PRESENT/);
  assert.equal(route.includes('.rpc("user_has_role_in_school"'), false);
});

test("historical reconciliation is student-scoped, fail-closed and has an explicit signed sequence", () => {
  assert.match(route, /searchParams\.get\("matricula_id"\)/);
  assert.match(route, /\.eq\("escola_id", escolaId\)\.eq\("id", parsedId\.data\)/);
  assert.match(route, /const legalConflict = Boolean/);
  assert.match(route, /"decisao"/);
  assert.match(route, /"ratificacao"/);
  assert.match(route, /"fecho"/);
  assert.match(route, /HISTORICAL_RATIFICATION_REQUIRED/);
  assert.match(ui, /window\.confirm\(instruction\)/);
  assert.match(ui, /"CONFIRMO_FECHO_LEGAL"/);
  assert.match(ui, /matricula_id: matriculaId/);
  assert.match(ui, /onRecheck\(\)/);
  assert.match(balc, /<BalcaoHistoricalAcademicRecovery/);
  assert.match(balc, /showAcademicResolution && raaMatriculaId && raaAlunoId && !historicalRecovery/);
});

test("closed origin remains read-only; no global reactivation of 2025 or synthetic marks", () => {
  assert.match(status, /originYear\?\.ativo === true/);
  assert.match(status, /matriculaOrigem\.status_fecho_origem == null/);
  assert.match(balc, /rematriculaOrigemAno === rematriculaContextYear\.ano - 1/);
  assert.doesNotMatch(migration, /UPDATE public\.anos_letivos SET ativo\s*=\s*true/i);
  assert.doesNotMatch(migration, /INSERT INTO public\.notas/i);
});

test("destination activation keeps previously locked origin unchanged", () => {
  assert.match(finalizacao, /CREATE OR REPLACE FUNCTION public\.finalizar_rematricula_balcao/);
  assert.match(finalizacao, /AND COALESCE\(v_raa->>'fonte_decisao',''\) <> 'historico_documental_ratificado'/);
  assert.match(finalizacao, /AND v_decision IN \('transitou','retido'\)/);
  assert.match(finalizacao, /'REMATRICULA_ACADEMIC_BLOCKED'/);
});

test("physical-pauta grade entry is the primary action before the first historical mark", () => {
  const situation = read("../../src/components/secretaria/BalcaoSituacaoAcademica.tsx");
  const modal = read("../../src/components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(route, /gradeSourceEligible \? "notas"/);
  assert.match(route, /const numericPauta = \["quantitativa_primario", "quantitativa_secundario"\]/);
  assert.doesNotMatch(route, /gradeSourceEligible && \(temNotasLancadas \|\| !documentaryEligible\)/);
  assert.match(situation, /Lançar notas de /);
  assert.match(situation, /historicalReviewTarget && !historicalTarget/);
  assert.match(modal, /historical_motivo: historicPautaReason/);
  assert.doesNotMatch(modal, /setMotivoHistorico/);
  assert.doesNotMatch(modal, /O lançamento fica registado com o utilizador/);
});
