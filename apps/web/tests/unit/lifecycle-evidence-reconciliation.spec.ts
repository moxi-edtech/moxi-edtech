import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd().replace(/\\/g, "/").endsWith("/apps/web")
  ? process.cwd()
  : resolve(process.cwd(), "apps/web");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const sql = read("../../supabase/migrations/20271029100000_lifecycle_reconciliation_evidence_guards.sql");
const api = read("src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
const page = read("src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
const orchestrator = read("src/lib/secretaria/fechamentoAcademicoOrchestrator.ts");

test("empty official gradebook cannot silently approve an enrollment", () => {
  assert.match(sql, /v_official_rows\s*[:=]/);
  assert.match(sql, /IF v_official_rows = 0 THEN/);
  assert.match(sql, /situacao_final','incompleto'/);
  assert.doesNotMatch(sql, /IF v_official_rows = 0 THEN\s*RETURN jsonb_build_object\('situacao_final','aprovado'/);
});

test("academic reconciliation validates authorized cohorts and documentary source", () => {
  assert.match(sql, /ASSISTED_TRANSITION_COHORT_REQUIRED/);
  assert.match(sql, /ACADEMIC_DOCUMENT_REQUIRED/);
  assert.match(read("../../supabase/migrations/20271029235910_lifecycle_persisted_status_contract_v3.sql"), /v_status := 'concluido'/);
  assert.match(sql, /matricula_id=excluded\.matricula_id/);
  assert.match(sql, /snapshot_status','aberto'/);
});

test("legal locks require linked history and accountable school evidence", () => {
  assert.match(sql, /ACADEMIC_HISTORY_NOT_FINAL/);
  assert.match(sql, /ACADEMIC_RESULT_NOT_VERIFIED/);
  assert.match(sql, /ACADEMIC_DECISION_EVIDENCE_REQUIRED/);
  assert.match(sql, /al\.actor_id IS NOT NULL/);
  assert.match(sql, /NEW\.historico_ano_id := v_historico\.id/);
});

test("school-ratification RPC requires admin, documentary evidence, and result match", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ratificar_resultado_historico_escola/);
  assert.match(sql, /ARRAY\['admin','admin_escola','staff_admin'\]/);
  assert.match(sql, /RATIFICATION_DOCUMENT_REQUIRED/);
  assert.match(sql, /v_h\.resultado_final IS DISTINCT FROM v_resultado/);
  assert.match(read("../../supabase/migrations/20271029235910_lifecycle_persisted_status_contract_v3.sql"), /v_m.status IS DISTINCT FROM 'concluido'/);
  assert.match(sql, /'snapshot_status','aberto'/);
});

test("secretaria API verifies school and limits all writers to direction", () => {
  assert.match(api, /requireRoleInSchool\(\{ supabase, escolaId, roles: \[\.\.\.WriteRoles\] \}\)/);
  assert.match(api, /z\.literal\("CONFIRMO_FECHO_LEGAL"\)/);
  assert.match(api, /supabase\.rpc\("finalizar_origem_academica"/);
  assert.match(api, /supabase\.rpc\("ratificar_resultado_historico_escola"/);
  assert.match(api, /supabase\.rpc\("historico_set_snapshot_state"/);
  assert.doesNotMatch(api, /from\("matriculas"\)\.update\(/);
  assert.doesNotMatch(api, /from\("historico_anos"\)\.update\(/);
});

test("historical queue asks for a school document and explicit legal confirmation", () => {
  assert.match(page, /Registe apenas resultados comprovados por decisões da escola/);
  assert.match(page, /Referência do documento da escola/);
  assert.match(page, /Confirm[eia]i o documento/);
  assert.match(page, /CONFIRMO_FECHO_LEGAL/);
  assert.match(page, /data\?\.permite_escrita === true/);
});

test("orchestrator treats incomplete GradeEngine responses as errors", () => {
  assert.match(orchestrator, /data\?\.ok !== true \|\| data\?\.status === "incompleto"/);
  assert.match(orchestrator, /if \(fechamentoErrors\.length > 0 \|\| finalizeErrors\.length > 0\)/);
  assert.match(orchestrator, /if \(historyErrors\.length > 0\)/);
  assert.match(orchestrator, /year rollover and legal snapshot are blocked/);
});

test("student and secretaria lifecycle portals never publish unclosed results", () => {
  const lifecycle = read("src/lib/matriculas/student-lifecycle.ts");
  const loader = read("src/lib/matriculas/load-student-lifecycle.ts");
  const student = read("src/app/api/aluno/home/status/route.ts");
  const school = read("src/app/api/secretaria/alunos/[id]/dossier/route.ts");
  assert.match(lifecycle, /resultadoOficialDb/);
  assert.match(loader, /v_student_lifecycle_status_v2/);
  assert.match(read("../../supabase/migrations/20271029235900_lifecycle_contextual_status_ssot_v2.sql"), /v_student_lifecycle_ssot_v1/);
  assert.match(student, /cicloVida/);
  assert.match(school, /cicloVida/);
});

test("Curtume numeric class metadata and future turma creation remain consistent", () => {
  const classes = read("../../supabase/migrations/20271029110000_curtume_class_metadata_and_transition_lineage.sql");
  const turmas = read("../../supabase/migrations/20271029130000_curtume_turma_classe_number_consistency.sql");
  assert.match(classes, /UPDATE public\.classes/);
  assert.match(classes, /trg_guard_matricula_transition_lineage/);
  assert.match(classes, /INVALID_TRANSITION_LINEAGE/);
  assert.match(turmas, /UPDATE public\.turmas/);
  assert.match(turmas, /trg_curtume_normalize_turma_classe_num/);
  assert.match(turmas, /TURMA_CLASS_NUMBER_CONFLICT/);
  assert.match(turmas, /1\[0-3\]/);
});
test("legal publication does not accept a destination inconsistent with ratified outcome", () => {
  const lock = read("../../supabase/migrations/20271029120000_curtume_legal_history_destination_guard.sql");
  assert.match(lock, /trg_curtume_guard_legal_history_destination/);
  assert.match(lock, /ACADEMIC_TRANSITION_LINK_REQUIRED/);
  assert.match(lock, /ACADEMIC_DESTINATION_CONFLICT/);
  assert.match(lock, /v_result='aprovado'/);
  assert.match(lock, /v_result='reprovado'/);
});
test("secretaria flags placement anomalies and never defaults to approving", () => {
  assert.match(api, /compareNextYearEnrollment/);
  assert.match(api, /confirmedOutcomeFitsDestination/);
  assert.match(api, /TRANSICAO_ACADEMICA_DIVERGENTE/);
  assert.match(page, /Selec(?:cione|ione) o resultado documentado/);
  assert.match(page, /useState<Resultado \| "">\(""/);
  assert.match(page, /Rever vínculo e turma no Balcão/);
  assert.match(page, /requestSeq/);
});
