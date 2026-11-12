import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const gradeSql = read("../../../../supabase/migrations/20271109030000_balcao_notas_historicas_individuais.sql");
const lateSql = read("../../../../supabase/migrations/20271109015000_balcao_rematricula_fora_prazo_individual.sql");
const finalSql = read("../../../../supabase/migrations/20271109020000_rematricula_preserva_origem_legal_fechada.sql");
const directSql = read("../../../../supabase/migrations/20271109050000_balcao_rematricula_fora_epoca_direta.sql");
const notas = read("../../src/app/api/secretaria/notas/route.ts");
const lateApi = read("../../src/app/api/secretaria/balcao/rematriculas/fora-prazo/route.ts");
const status = read("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts");
const confirm = read("../../src/app/api/secretaria/balcao/rematriculas/route.ts");
const gradeModal = read("../../src/components/secretaria/EnrollmentPostActionModal.tsx");
const balc = read("../../src/components/secretaria/BalcaoAtendimento.tsx");

test("a closed academic year may receive one audited grade without global reopening", () => {
  assert.match(gradeSql, /CREATE OR REPLACE FUNCTION public\.lancar_nota_historica_individual/);
  assert.match(gradeSql, /public\.lancar_notas_batch\(/);
  assert.match(gradeSql, /BALCAO_NOTA_HISTORICA_LANCADA/);
  assert.match(gradeSql, /can_write_historical_grade/);
  assert.match(gradeSql, /DELETE FROM public\.balcao_grade_historic_nonce/);
  assert.match(gradeSql, /eu\.papel IN \('secretaria','admin_secretaria','diretor'/);
  assert.match(gradeSql, /NOT EXISTS \(\s*SELECT 1 FROM public\.historico_anos/);
  assert.doesNotMatch(gradeSql, /UPDATE public\.anos_letivos\s+SET ativo\s*=\s*true/);
  assert.match(gradeSql, /GRANT EXECUTE ON FUNCTION public\.lancar_nota_historica_individual/);
});

test("grade UI and authenticated API use selected source enrollment and reason", () => {
  assert.match(notas, /historical_matricula_id/);
  assert.match(notas, /historical_motivo/);
  assert.match(notas, /operation: 'READ'/);
  assert.match(notas, /operation: 'WRITE'/);
  assert.match(notas, /lancar_nota_historica_individual/);
  assert.match(gradeModal, /Lançar nota do ano anterior/);
  assert.match(gradeModal, /Transcrição de nota conforme pauta física escolar/);
  assert.match(gradeModal, /historical_motivo: historicPautaReason/);
  assert.doesNotMatch(gradeModal, /Motivo do lançamento retroativo/);
  assert.match(gradeModal, /historical_matricula_id: historicalMatriculaId/);
  assert.match(balc, /onLancarNotaHistorica/);
});

test("Balcão conclui fora da janela sem pedido individual, com RAA e auditoria", () => {
  assert.match(lateSql, /CREATE TABLE public\.balcao_late_reenroll_authorizations/);
  assert.match(lateSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(directSql, /CREATE OR REPLACE FUNCTION public\.finalizar_rematricula_balcao/);
  assert.match(directSql, /v_is_late_enrollment := NOT EXISTS/);
  assert.match(directSql, /BALCAO_REMATRICULA_FORA_PRAZO_CONCLUIDA/);
  assert.match(directSql, /'modo','direta'/);
  assert.match(directSql, /FOR UPDATE/);
  assert.match(directSql, /public\.user_has_role_in_school/);
  assert.match(directSql, /public\.resolve_raa_progression_for_matricula/);
  assert.match(directSql, /matricula_destino_id/);
  assert.doesNotMatch(directSql, /balcao_late_reenroll_authorizations/);
  assert.doesNotMatch(directSql, /REMATRICULA_WINDOW_CLOSED/);
  assert.doesNotMatch(confirm, /tem_autorizacao_rematricula_fora_prazo/);
  assert.doesNotMatch(status, /autorizacaoForaPrazo|status = "WINDOW_CLOSED"/);
  assert.doesNotMatch(balc, /<BalcaoLateRematriculaAuthorization/);
  assert.doesNotMatch(lateSql, /UPDATE public\.rematricula_janelas/i);
  assert.match(finalSql, /public\.resolve_raa_progression_for_matricula/);
});
