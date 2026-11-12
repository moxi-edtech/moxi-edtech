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
for (const migration of migrations.filter((file) => file > finalName)) {
  const source = readFileSync(join(dir, migration), "utf8");
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
