import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const dir = join(root, "supabase/migrations");
const finalName = "20271029235910_lifecycle_persisted_status_contract_v3.sql";
const evidenceName = "20271029100000_lifecycle_reconciliation_evidence_guards.sql";
const migrations = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
assert.ok(migrations.includes(finalName), "Lifecycle SSOT consolidation migration missing");
const prerequisites = [
  "20261204110000_historico_snapshot_lock_and_reopen_policy.sql",
  "20261215010000_canonicalize_matricula_status_ativo.sql",
  "20271022142000_cc003_canonical_polo_rls.sql",
  "20271027120000_lifecycle_ssot_post_replay_guard.sql",
  evidenceName,
  "20271029235900_lifecycle_contextual_status_ssot_v2.sql",
];
for (const required of prerequisites) {
  assert.ok(migrations.includes(required), "Missing SSOT prerequisite: " + required);
  assert.ok(required < finalName, "SSOT prerequisite must precede final migration: " + required);
}
// Future migrations are permitted, but cannot silently overwrite the
// stabilized lifecycle RPCs, SSOT view, or role policies.
const protectedWriters = /(?:CREATE\s+OR\s+REPLACE\s+(?:FUNCTION|VIEW)\s+public\.(?:gradeengine_calcular_situacao|finalizar_origem_academica|ratificar_resultado_historico_escola|lifecycle_validate_historico_legal_lock|finalizar_matricula_blindada|gerar_historico_anual|sync_historico_anos_compat|lifecycle_sync_matricula_ativo|activate_aluno_after_matricula|v_student_lifecycle_ssot_v1)\b|(?:DROP|CREATE)\s+POLICY\s+lifecycle_matriculas_)/i;
// A single explicit lifecycle protocol upgrade, backed by disposable-PG
// contract tests. Later migrations may not redefine these protected writers
// without another reviewed protocol update and a matching isolated regression.
const historicBridge = "20271109010000_raa_historico_documental_ratificado.sql";
const historicStaffAccess = "20271112010000_balcao_historic_full_staff_permissions.sql";
const primarySecondaryBridge = "20271112020000_balcao_primary_secondary_6_to_7.sql";
const physicalPautaSource = "20271112030000_balcao_pauta_corrigir_turma_origem.sql";
const individualJourney = "20271112050000_balcao_percurso_academico.sql";
for (const migration of migrations.filter((file) => file > finalName)) {
  const source = readFileSync(join(dir, migration), "utf8");
  if (migration === "20271113090000_corrigir_nome_aluno_balcao.sql") {
    // Reviewed limited purpose: edit identity; never academic results, payments or tenant scope.
    for (const token of [
      "CREATE OR REPLACE FUNCTION public.corrigir_nome_aluno_balcao",
      "SECURITY DEFINER", "SET search_path = ''", "auth.uid()",
      "eu.escola_id = v_escola_id", "eu.user_id = v_actor",
      "'admin_financeiro'", "'admin_secretaria'", "'secretaria'",
      "FOR UPDATE", "p_nome_anterior IS NOT NULL",
      "UPDATE public.alunos SET nome", "UPDATE public.profiles SET nome",
      "INSERT INTO public.audit_logs", "ALUNO_NOME_CORRIGIDO",
      "REVOKE ALL ON FUNCTION public.corrigir_nome_aluno_balcao",
      "TO authenticated",
    ]) assert.ok(source.includes(token), "Student name correction missing reviewed guard: " + token);
    assert.doesNotMatch(source,
      /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:mensalidades|pagamentos|notas|matriculas|financeiro_\w+)\b/i,
      "Name correction cannot alter finance or academic records");
    assert.doesNotMatch(source, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|POLICY)\b/i,
      "Name correction cannot redefine tables or policies");
  }
  if (migration === historicBridge) {
    const mandatory = [
      "CREATE OR REPLACE FUNCTION public.finalizar_origem_academica",
      "CREATE OR REPLACE FUNCTION public.ratificar_resultado_historico_escola",
      "CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula",
      "CREATE OR REPLACE FUNCTION public.historico_set_snapshot_state",
      "ACADEMIC_DOCUMENT_GRADES_PRESENT",
      "HISTORICAL_SNAPSHOT_AUTH_FORBIDDEN",
      "'ratificacao',true",
      "'papel_autorizado'",
      "h.snapshot_status='fechado'",
      "sl.historico_ano_id=h.id",
      "'fonte_decisao','historico_documental_ratificado'",
      "public.current_tenant_escola_id()",
      "REVOKE ALL ON FUNCTION public.finalizar_origem_academica",
    ];
    for (const contract of mandatory) {
      assert.ok(source.includes(contract),
        "Historical lifecycle bridge missing reviewed guard: " + contract);
    }
    for (const file of [
      "supabase/ops/tests/raa_historico/fixture.sql",
      "supabase/ops/tests/raa_historico/regression.sql",
      ".github/workflows/raa-historico-documental.yml",
    ]) {
      assert.ok(readFileSync(join(root,file),"utf8").length > 500,
        "Historical lifecycle bridge requires isolated integration coverage: "+file);
    }
    continue;
  }
  // Reviewed school-operator authorization upgrade: no grade/outcome evidence
  // bypass and no changes to the lifecycle SSOT projection or other writers.
  if (migration === historicStaffAccess) {
    const mandatory = [
      "CREATE OR REPLACE FUNCTION public.lancar_nota_historica_individual",
      "CREATE OR REPLACE FUNCTION public.lancar_notas_batch",
      "CREATE OR REPLACE FUNCTION public.finalizar_origem_academica",
      "CREATE OR REPLACE FUNCTION public.ratificar_resultado_historico_escola",
      "CREATE OR REPLACE FUNCTION public.historico_set_snapshot_state",
      "CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula",
      "CREATE OR REPLACE FUNCTION public.solicitar_regularizacao_historica_balcao",
      "ALTER POLICY balcao_historic_recovery_school_read",
      "ALTER TABLE public.escola_users ADD CONSTRAINT escola_users_papel_check",
      "admin_financeiro", "admin_secretaria", "admin_secretario",
      "public.current_tenant_escola_id()",
      "ACADEMIC_DOCUMENT_GRADES_PRESENT",
      "HISTORICAL_SNAPSHOT_AUTH_FORBIDDEN",
      "BALCAO_NOTA_HISTORICA_LANCADA",
      "'papel_autorizado'",
    ];
    for (const contract of mandatory) {
      assert.ok(source.includes(contract), "Historical operator grant missing guard: " + contract);
    }
    assert.doesNotMatch(source, /CREATE\\s+OR\\s+REPLACE\\s+VIEW\\s+public\\./i,
      "Staff access migration must not rewrite lifecycle status projections");
    assert.ok(readFileSync(join(root,
      "apps/web/tests/unit/balcao-historic-actionability.spec.ts"), "utf8")
        .includes("four authorized staff profiles"),
      "Historical operator changes require staff-role regression coverage");
    continue;
  }
  // The selected school primary/secondary bridge is not an unrestricted
  // inter-course transfer. RAA eligibility and tenant/source/year guards remain.
  if (migration === primarySecondaryBridge) {
    for (const token of [
      "CREATE OR REPLACE FUNCTION public.preparar_aluno_para_rematricula",
      "CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao",
      "v_source_number = 6",
      "v_numero_origem = 6",
      "v_numero_destino = 7",
      "v_source_turma.nivel_ensino = 'primario'",
      "v_target_turma.nivel_ensino = 'secundario'",
      "v_classe_origem.nivel_ensino = 'primario'",
      "v_classe_destino.nivel_ensino = 'secundario'",
      "resolve_raa_progression_for_matricula",
      "public.current_tenant_escola_id()",
      "NOT v_retido",
    ]) assert.ok(source.includes(token),
      "Missing 6th-to-7th school transition guard: " + token);
    assert.doesNotMatch(source, /CREATE\\s+OR\\s+REPLACE\\s+VIEW\\s+public\\./i,
      "Bridge must not change student lifecycle projections");
    continue;
  }
  if (migration === physicalPautaSource) {
    for (const token of [
      "CREATE OR REPLACE FUNCTION public.balcao_corrigir_turma_origem_pauta",
      "CREATE OR REPLACE FUNCTION public.guard_turma_transfer_academic_evidence_v1",
      "CREATE OR REPLACE FUNCTION public.guard_turma_transfer_secondary_evidence_v1",
      "CREATE TABLE IF NOT EXISTS public.balcao_pauta_turma_correction_nonce",
      "REVOKE ALL ON TABLE public.balcao_pauta_turma_correction_nonce",
      "current_tenant_escola_id()",
      "user_has_role_in_school",
      "status_fecho_origem",
      "SELECT 1 FROM public.notas",
      "BALCAO_PAUTA_TURMA_ORIGEM_CORRIGIDA",
      "pg_catalog.jsonb_build_object('turma_id',v_old_turma.id)",
      "pg_catalog.jsonb_build_object('turma_id',v_new_turma.id)",
    ]) assert.ok(source.includes(token), "Missing trusted physical pauta correction contract: " + token);
    assert.doesNotMatch(source, /CREATE\\s+OR\\s+REPLACE\\s+VIEW\\s+public\\./i,
      "Source-class correction must not change lifecycle projections");
    const regression = readFileSync(join(root,
      "supabase/ops/tests/balcao_exceptional/physical_pauta_source_regression.sql"), "utf8");
    assert.ok(regression.includes("other-school operator") &&
      regression.includes("before/after automatic audit missing"),
      "A source-class correction requires an authenticated PG negative test");
    continue;
  }
  // Explicitly reviewed individual recovery protocol. It preserves the
  // lifecycle projection and cannot introduce financial/table/policy changes.
  if (migration === individualJourney) {
    for (const token of [
      "public.balcao_concluir_ano_percurso", "public.balcao_pauta_completa",
      "public.balcao_origem_percurso_elegivel", "public.current_tenant_escola_id()",
      "ACADEMIC_GRADES_INCOMPLETE", "ACADEMIC_DOCUMENT_GRADES_PRESENT",
      "ACADEMIC_PREVIOUS_YEAR_PENDING", "ACADEMIC_PREVIOUS_DEBT_PENDING",
      "ACADEMIC_PATH_MISMATCH", "ACADEMIC_DESTINATION_CONFLICT",
      "BALCAO_ANO_PERCURSO_CONCLUIDO", "'ratificacao',true",
      "sl.historico_ano_id=h.id", "nt.matricula_id=p_matricula",
      "REVOKE ALL ON FUNCTION public.balcao_concluir_ano_percurso",
    ]) assert.ok(source.includes(token), "Individual journey missing reviewed guard: " + token);
    assert.doesNotMatch(source, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|POLICY)\b/i,
      "Individual journey must reuse tables, policies and lifecycle projections");
    assert.doesNotMatch(source, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:mensalidades|pagamentos|financeiro_\w+)\b/i,
      "Individual academic closure must not settle or invent financial entries");
    const regression = readFileSync(join(root,"supabase/ops/tests/raa_historico/percurso_regression.sql"),"utf8");
    for (const evidence of ["crossed tenant", "partial year closed", "unpaid previous year ignored", "partial result escaped rollback", "changed another pupil", "grades leaked to a classmate", "direct generic RPC bypassed full transcription"])
      assert.ok(regression.includes(evidence), "Individual recovery needs disposable PG evidence: " + evidence);
    assert.ok(readFileSync(join(root,".github/workflows/raa-historico-documental.yml"),"utf8")
      .includes("percurso_regression.sql"), "Individual recovery requires an actual PostgreSQL CI job");
    continue;
  }
  assert.ok(!protectedWriters.test(source),
    migration + " changes SSOT writers or policies after stabilization; update lifecycle contract first");
}
const archives = readdirSync(join(root, "supabase/ops/applied_lifecycle_20261028"))
  .filter((f) => /^20261028.*\.sql$/.test(f));
assert.equal(archives.length, 11, "11 original installed lifecycle migrations must remain archived");
for (const file of archives) {
  const shim = readFileSync(join(dir, file), "utf8");
  assert.match(shim, /SELECT 1 WHERE false;/, file + " must defer until late replay");
}
const content = readFileSync(join(dir, evidenceName), "utf8");
const v3 = readFileSync(join(dir, finalName), "utf8");
assert.match(v3, /ACADEMIC_RESULT_NOT_ENROLLMENT_STATUS/);
assert.match(v3, /MATRICULA_STATUS_INVALID/);
assert.match(v3, /matriculas_status_check/);
assert.match(v3, /resultado_final/);
const oldRebuild = readFileSync(join(dir, "20271027120000_lifecycle_ssot_post_replay_guard.sql"),"utf8");
assert.match(oldRebuild,/security_invoker=true/,"Original SSOT rebuild must remain stable");
const remoteArchive = readdirSync(join(root, "supabase/ops/applied_lifecycle_20261029"))
  .filter((f) => /^20261029.*\.sql$/.test(f));
assert.equal(remoteArchive.length,3,"Three installed 2026-10-29 academic-only fixes must be archived");
for (const file of remoteArchive) {
  const shim = readFileSync(join(dir, file),"utf8");
  assert.match(shim,/SELECT 1 WHERE false;/,"Installed academic fix must defer to late replay: " + file);
}
for (const token of [
  "gradeengine_calcular_situacao","v_official_rows = 0",
  "finalizar_origem_academica","ratificar_resultado_historico_escola",
  "trg_lifecycle_guard_official_history_lock", "ACADEMIC_DECISION_EVIDENCE_REQUIRED"
]) {
  assert.ok(content.includes(token), "missing final lifecycle guard " + token);
}
console.log("Lifecycle migration replay ordering and integrity contract OK");
