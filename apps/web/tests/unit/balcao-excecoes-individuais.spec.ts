import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const gradeSql = read("../../../../supabase/migrations/20271109030000_balcao_notas_historicas_individuais.sql");
const lateSql = read("../../../../supabase/migrations/20271109015000_balcao_rematricula_fora_prazo_individual.sql");
const finalSql = read("../../../../supabase/migrations/20271109020000_rematricula_preserva_origem_legal_fechada.sql");
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
  assert.match(gradeModal, /Motivo do lançamento retroativo/);
  assert.match(gradeModal, /historical_matricula_id: historicalMatriculaId/);
  assert.match(balc, /onLancarNotaHistorica/);
});

test("closed-window renewal has a scoped, audited, expiring and single-use permission", () => {
  assert.match(lateSql, /CREATE TABLE public\.balcao_late_reenroll_authorizations/);
  assert.match(lateSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(lateSql, /REVOKE ALL ON public\.balcao_late_reenroll_authorizations/);
  assert.match(lateSql, /expires_at>now\(\)/);
  assert.match(lateSql, /actor_id=auth\.uid\(\)/);
  assert.match(lateSql, /BALCAO_REMATRICULA_FORA_PRAZO_AUTORIZADA/);
  assert.match(finalSql, /BALCAO_REMATRICULA_FORA_PRAZO_CONCLUIDA/);
  assert.match(finalSql, /FOR UPDATE/);
  assert.match(finalSql, /used_at=now\(\)/);
  assert.match(finalSql, /REMATRICULA_WINDOW_CLOSED/);
  assert.match(lateApi, /autorizar_rematricula_fora_prazo/);
  assert.match(confirm, /tem_autorizacao_rematricula_fora_prazo/);
  assert.match(status, /autorizacaoForaPrazo/);
  assert.match(balc, /BalcaoLateRematriculaAuthorization/);
  assert.doesNotMatch(lateSql, /UPDATE public\.rematricula_janelas/i);
});
