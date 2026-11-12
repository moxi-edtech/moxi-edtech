import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (file: string) =>
  readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../../supabase/migrations/20271112040000_balcao_retificacao_classe_sem_progressao.sql", import.meta.url),
  "utf8",
);
const api = source("app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts");
const situacao = source("app/api/secretaria/balcao/situacao-academica/route.ts");
const form = source("components/secretaria/BalcaoEnrollmentCorrection.tsx");
const panel = source("components/secretaria/BalcaoSituacaoAcademica.tsx");

test("class correction is an audited same-year change, never a promotion or a payment mutation", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.retificar_classe_matricula/);
  assert.match(migration, /v_origem\.session_id IS DISTINCT FROM v_destino\.session_id/);
  assert.match(migration, /v_m\.session_id IS DISTINCT FROM v_origem\.session_id/);
  assert.doesNotMatch(migration, /v_origem\.curso_id IS DISTINCT FROM v_destino\.curso_id/);
  assert.match(migration, /v_destino\.ano_letivo_id IS DISTINCT FROM v_destino\.session_id/);
  assert.match(migration, /y\.ativo IS TRUE/);
  assert.match(migration, /public\.turma_transfer_academic_evidence_v1\(v_m\.id\)/);
  assert.match(migration, /USING ERRCODE='P1050'/);
  assert.match(migration, /INSERT INTO public\.balcao_pauta_turma_correction_nonce/);
  assert.match(migration, /DELETE FROM public\.balcao_pauta_turma_correction_nonce/);
  assert.match(migration, /INSERT INTO public\.audit_logs/);
  assert.match(migration, /v_historico_apos IS DISTINCT FROM v_historico/);
  assert.doesNotMatch(migration, /\b(INSERT INTO|UPDATE|DELETE FROM) public\.(notas|mensalidades|pagamentos|financeiro_cobrancas|historico_anos)\b/i);
});

test("authorizations match at RLS/RPC and Next.js layers for the supported staff roles", () => {
  for (const role of ["secretaria", "admin_secretaria", "admin_secretario", "admin_financeiro", "admin", "admin_escola"]) {
    assert.ok(migration.includes("'" + role + "'"), role);
    assert.ok(api.includes('"' + role + '"'), role);
    assert.ok(situacao.includes('"' + role + '"'), role);
  }
  assert.match(api, /resolveEscolaIdForUser\(supabase, user\.id\)/);
  assert.match(api, /\.eq\("escola_id", escolaId\)\.eq\("id", matriculaId\)/);
  assert.match(api, /\.eq\("escola_id",escolaId\)\.eq\("session_id",matricula\.session_id\)/);
  assert.match(migration, /public\.current_tenant_escola_id\(\)/);
});

test("the same-year correction does not use the RAA progression filter", () => {
  assert.match(api, /\/\* The options are scoped to the SAME student's enrollment/);
  assert.match(api, /\.eq\("status_validacao","ativo"\)/);
  assert.match(api, /assertAcademicYearEntity/);
  assert.match(api, /ctx\.matricula\.session_id !== parsed\.data\.ano_letivo_id/);
  assert.match(api, /requer_conciliacao_academica/);
  assert.match(api, /impact\.blockers/);
  assert.doesNotMatch(api, /INSERT INTO|\.insert\(/i);
});

test("the action is discoverable inside Situação académica with a guarded preview", () => {
  assert.match(situacao, /can_rectify_class/);
  assert.match(panel, /<BalcaoEnrollmentCorrection/);
  assert.match(panel, /fieldset disabled=\{pautaBusy\}/);
  assert.match(form, /target_turma_id/);
  assert.match(form, /confirmar_historico: confirmHistory/);
  assert.match(form, /motivo\.trim\(\)\.length >= 10/);
  assert.match(form, /body\.aluno_id !== alunoId/);
  assert.match(form, /await onSaved\(\)/);
  assert.doesNotMatch(form, /\/api\/secretaria\/notas|\/api\/secretaria\/pagamentos\/processar/);
});
