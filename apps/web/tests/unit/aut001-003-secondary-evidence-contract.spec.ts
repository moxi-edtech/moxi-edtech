import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(process.cwd(), "../..");
const source = (file: string) => readFileSync(resolve(repo, file), "utf8");

test("AUT-001: the secondary transfer gate is fail closed for all official and legacy academic history", () => {
  const sql = source("supabase/migrations/20271031005000_guard_secondary_academic_transfer_evidence.sql");
  for (const table of [
    "notas_avaliacoes", "lancamentos", "historico_snapshot_locks",
    "historico_anos", "reapreciacao_pedidos", "raa_indisciplina_eventos",
    "aluno_falta_justificacoes", "pautas_oficiais", "pautas_lote_itens",
    "melhoria_nota_pedidos", "dependencias_academicas_transicao",
    "promocoes_com_pendencias",
    "excecoes_pauta", "presencas_deprecated",
  ]) {
    assert.ok(sql.includes("public." + table), "Missing academic source " + table);
  }
  assert.match(sql, /CREATE TRIGGER trg_guard_turma_transfer_secondary_evidence/);
  assert.match(sql, /ERRCODE = 'P1050'/);
  assert.match(sql, /FOR SHARE/);
  assert.match(sql, /LANGUAGE sql VOLATILE SECURITY DEFINER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.turma_transfer_has_secondary_evidence_v1/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.(notas|matriculas|frequencias|pautas_oficiais)\s+SET/i);
});

test("AUT-002: the authenticated preflight shares the canonical database predicate", () => {
  const sql = source("supabase/migrations/20271031005000_guard_secondary_academic_transfer_evidence.sql");
  const preview = source("apps/web/src/app/api/secretaria/matriculas/[matriculaId]/check-transfer/route.ts");
  const classCorrection = source("apps/web/src/app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.turma_transfer_academic_evidence_v1/);
  assert.match(sql, /v_actor IS NULL OR v_escola IS NULL/);
  assert.match(sql, /public\.user_has_role_in_school/);
  assert.match(sql, /WHERE id=p_matricula_id AND escola_id=v_escola/);
  assert.match(sql, /public\.turma_transfer_has_secondary_evidence_v1\(/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.turma_transfer_academic_evidence_v1\(uuid\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.turma_transfer_academic_evidence_v1\(uuid\)/);
  assert.match(preview, /\.rpc\("turma_transfer_academic_evidence_v1"/);
  assert.match(preview, /typeof evidence\.data\?\.has_evidence !== "boolean"/);
  assert.match(preview, /\.from\("turmas"\)/);
  assert.doesNotMatch(preview, /\.from\("vw_turmas_para_matricula"\)/);
  assert.match(classCorrection, /\.rpc\("turma_transfer_academic_evidence_v1"/);
  assert.match(classCorrection, /typeof academicEvidence\.data\?\.has_evidence !== "boolean"/);
});

test("AUT-003: history-aware single and bulk writers agree on role, event code and atomicity", () => {
  const single = source("apps/web/src/app/api/secretaria/matriculas/[matriculaId]/transfer/route.ts");
  const bulk = source("apps/web/src/app/api/secretaria/turmas/[id]/transferir/route.ts");
  const sql = source("supabase/migrations/20271031005000_guard_secondary_academic_transfer_evidence.sql");
  const isolated = source("supabase/ops/tests/bulk_turma_transfer_isolated_verify.sh");
  assert.match(single, /const ALLOWED_ROLES = \["secretaria", "admin", "admin_escola", "staff_admin"\]/);
  assert.match(bulk, /const ALLOWED_ROLES = \["secretaria", "admin", "admin_escola", "staff_admin"\]/);
  assert.match(single, /\.rpc\('transferir_aluno_turma'/);
  assert.doesNotMatch(single, /\.rpc\('transferir_aluno_turma',[\s\S]*?\}\)\s*\.single\(\)/);
  assert.match(single, /rpcError\.code === "P1050"/);
  assert.match(bulk, /transferError\.code === "P1050"/);
  assert.match(sql, /CREATE TRIGGER a_00_lock_legacy_historico_turma/);
  assert.match(isolated, /20271031005000_guard_secondary_academic_transfer_evidence\.sql/);
  assert.match(isolated, /bulk_turma_transfer_secondary_evidence\.sql/);
  assert.match(isolated, /bulk_turma_transfer_secondary_race\.sh/);
});
