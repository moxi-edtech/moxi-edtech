import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkFiscalAndSchemaScope, LIFECYCLE_MIGRATION_ALLOWLIST } from "../guard-fiscal-scope.mjs";

const firstLifecycle = "supabase/migrations/20261028211433_lifecycle_sync_status_ativo_20261028.sql";
const finalLifecycle = "supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql";

test("only the reviewed curriculum-assessment guard may change installation SQL", () => {
  const file = "20271118120000_guard_turma_assessment_identity_install.sql";
  const path = "supabase/migrations/" + file;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(file));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271118120001_unreviewed_install.sql"])[0] ?? "",
    /Unapproved database migration/);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1 $;")[0] ?? "",
    /Fiscal[/]AGT activation/);
});

test("allows only audited enrollment and historical evidence migrations", () => {
  assert.equal(LIFECYCLE_MIGRATION_ALLOWLIST.size, 81);
  const reativacao = "20271119093000_matricula_desistencia_reativacao_v2.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(reativacao));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + reativacao]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271119093001_unreviewed_reactivation.sql"])[0] ?? "", /Unapproved database migration/);
  const exactDiagnostics = "20271118130000_curtume_2025_persist_fecho_diagnostics.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(exactDiagnostics));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + exactDiagnostics]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + exactDiagnostics], () =>
    "CREATE TABLE public.fiscal_config (enabled boolean);")[0] ?? "", /Fiscal[/]AGT activation/);
  const batchPauta = "20271117190000_curtume_fechar_pautas_2025_lote.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(batchPauta));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + batchPauta]), []);
  // Exact CURTUME 2025 academic grade reconciliation, never a fiscal bypass.
  const signedPauta = "20271117230000_curtume_2025_signed_operational_grades_reconciliation.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(signedPauta));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + signedPauta]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + signedPauta], () =>
    "CREATE TABLE public.fiscal_configuration (enabled boolean);")[0] ?? "",
    /Fiscal[/]AGT activation/);
  const allowedFinanceiro = "20271118090000_curtume_2025_lote_admin_financeiro.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(allowedFinanceiro));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + allowedFinanceiro]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + allowedFinanceiro], () =>
    "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $x$ SELECT 1 $x$;")[0] ?? "",
    /Fiscal[/]AGT activation/);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271118090001_unreviewed.sql"])[0] ?? "",
    /Unapproved database migration/);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271117230001_unreviewed.sql"])[0] ?? "",
    /Unapproved database migration/);
  const finalistRaa = "20271117173000_raa_historical_finalists_and_voided_destinations.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(finalistRaa));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + finalistRaa]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + finalistRaa],
    () => "CREATE FUNCTION public.agt_activate() RETURNS void AS $ SELECT 1 $ LANGUAGE sql;"
  )[0] ?? "", /Fiscal[/]AGT activation/);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271117173001_unreviewed.sql"])[0] ?? "",
    /Unapproved database migration/);
  const scopedHistoricStaff = "20271112010000_balcao_historic_full_staff_permissions.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(scopedHistoricStaff));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + scopedHistoricStaff]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271112010001_unreviewed_role_bypass.sql"])[0] ?? "", /Unapproved database migration/);
  const primarySecondaryBridge = "20271112020000_balcao_primary_secondary_6_to_7.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(primarySecondaryBridge));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + primarySecondaryBridge]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271112020001_unreviewed_cross_course.sql"])[0] ?? "", /Unapproved database migration/);
  const pendingTuition = "20271116090000_balcao_retificacao_classe_repreco_pendentes.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(pendingTuition));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + pendingTuition]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + pendingTuition], () =>
    "CREATE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1; $;")[0] ?? "", /Fiscal[/]AGT activation/);
  const correction = "20271112040000_balcao_retificacao_classe_sem_progressao.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(correction));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + correction]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271112040001_unreviewed_class_promotion.sql"])[0] ?? "", /Unapproved database migration/);
  const physicalPautaSource = "20271112030000_balcao_pauta_corrigir_turma_origem.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(physicalPautaSource));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + physicalPautaSource]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271112030001_unreviewed_history_override.sql"])[0] ?? "", /Unapproved database migration/);
  assert.deepEqual(checkFiscalAndSchemaScope([firstLifecycle, finalLifecycle], () => "CREATE VIEW enrollment AS SELECT 1;"), []);
});


test("only the audited school withdrawal RPC migration is allowed without fiscal/AGT exceptions", () => {
  const name = "20271119090000_matricula_desistencia_operacional_v1.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  for (const hostile of [
    "CREATE TABLE public.fiscal_activacao (enabled boolean);",
    "CREATE FUNCTION public.agt_sync() RETURNS void LANGUAGE sql AS $$ SELECT 1; $$;",
    "CREATE TABLE public.saft_exports (id uuid);",
  ]) {
    assert.match(checkFiscalAndSchemaScope([path], () => hostile)[0] ?? "", /Fiscal[/]AGT activation/);
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271119090001_unreviewed_withdrawal.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("allows precisely the six audited Curtume academic migrations", () => {
  const migrations = [
    "20261029102650_curtume_class_metadata_and_transition_lineage_20261029.sql",
    "20261029103216_curtume_legal_history_destination_guard_20261029.sql",
    "20261029103555_curtume_turma_classe_number_consistency_20261029.sql",
    "20271029110000_curtume_class_metadata_and_transition_lineage.sql",
    "20271029120000_curtume_legal_history_destination_guard.sql",
    "20271029130000_curtume_turma_classe_number_consistency.sql",
  ].map((name) => "supabase/migrations/" + name);
  for (const path of migrations) {
    assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
      "CREATE TRIGGER academic_integrity BEFORE UPDATE ON matriculas EXECUTE FUNCTION guard_integrity();"), [], path);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.fiscal_integrations (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271029130001_curtume_unreviewed.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("global academic class metadata guard is allowlisted without fiscal exceptions", () => {
  const path = "supabase/migrations/20271029140000_global_academic_class_metadata_contract.sql";
  assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
    "CREATE TRIGGER trg_class_guard BEFORE INSERT ON classes EXECUTE FUNCTION class_guard();"), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "ALTER TABLE public.fiscal_config ADD COLUMN enabled boolean;")[0] ?? "", /Fiscal\/AGT activation/);
});

test("new atomic enrollment and live ledger markers stay within audited scope", () => {
  for (const path of [
    "20261029112728_enrollment_context_atomic_authorized_create_20261029.sql",
    "20271029150000_enrollment_context_atomic_authorized_create.sql",
  ]) {
    const name = "supabase/migrations/" + path;
    assert.deepEqual(checkFiscalAndSchemaScope([name], () =>
      "CREATE TRIGGER enrollment_guard BEFORE INSERT ON matriculas EXECUTE FUNCTION check_year();"), []);
    assert.match(checkFiscalAndSchemaScope([name], () =>
      "CREATE TABLE public.agt_integrations (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("read-only enrollment view migration is allowlisted without changing fiscal contracts", () => {
  for (const name of [
    "20261029113302_enrollment_view_academic_year_ssot_20261029.sql",
    "20271029151000_enrollment_view_academic_year_ssot.sql",
  ]) {
    const path = "supabase/migrations/" + name;
    assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
      "CREATE OR REPLACE VIEW vw_matriculas_validas AS SELECT session_id AS ano_letivo_id FROM matriculas;"), []);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.saft_export (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("contextual lifecycle view is the only newly allowed read-only migration", () => {
  const path = "supabase/migrations/20271029235900_lifecycle_contextual_status_ssot_v2.sql";
  assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
    "CREATE VIEW public.v_student_lifecycle_status_v2 AS SELECT 1;"), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE TABLE public.agt_configuration (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271029235901_unreviewed_lifecycle.sql"
  ])[0] ?? "", /Unapproved database migration/);
});

test("live-applied contextual status markers never permit fiscal activation", () => {
  for (const path of [
    "supabase/migrations/20261029132302_lifecycle_contextual_status_ssot_v2.sql",
    "supabase/migrations/20261029132512_lifecycle_contextual_status_v2_select_only.sql",
  ]) {
    assert.deepEqual(checkFiscalAndSchemaScope([path], () => "SELECT 1 WHERE false;"), []);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.fiscal_activacao (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
});


test("four PR #298 RAA/MED migrations are individually audited without unfreezing fiscal", () => {
  const approved = [
    "20271029235920_raa_balcao_authoritative_permissions.sql",
    "20271029235921_guard_grade_period_source_and_window.sql",
    "20271029235922_canonical_med_calendar_offering_profiles.sql",
    "20271029235923_apply_canonical_med_calendar_atomic.sql",
  ];
  assert.equal(approved.length, 4);
  for (const name of approved) {
    const path = "supabase/migrations/" + name;
    assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name), name);
    // Read the actual SQL on disk, not a synthetic fixture. Every file must
    // remain free of executable fiscal, AGT or SAF-T activation statements.
    assert.deepEqual(checkFiscalAndSchemaScope([path]), [], name);
    for (const statement of [
      "CREATE TABLE public.fiscal_config (enabled boolean);",
      "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1 $;",
      "CREATE TABLE public.saft_export (id uuid);",
    ]) {
      assert.ok(
        checkFiscalAndSchemaScope([path], () => statement)
          .some((violation) => violation.includes("Fiscal/AGT activation marker")),
        `${name} must reject ${statement}`,
      );
    }
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271029235925_unreviewed.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("P0 academic closure RLS is the only newly audited migration", () => {
  const name = "20271029235924_guard_fechamento_academico_jobs_rls.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  for (const activation of [
    "CREATE TABLE public.fiscal_config (enabled boolean);",
    "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1 $;",
    "CREATE TABLE public.saft_export (id uuid);",
  ]) {
    assert.match(checkFiscalAndSchemaScope([path], () => activation)[0] ?? "",
      /Fiscal\/AGT activation marker/);
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271029235925_unreviewed.sql"
  ])[0] ?? "", /Unapproved database migration/);
});

test("admissions decree RPC provenance migrations are audited without fiscal activation", () => {
  const entries = [
    "20261029181138_official_decree_period_provenance_guard.sql",
    "20261029181554_preserve_legacy_2025_calendar_provenance_compatibility.sql",
  ];
  for (const name of entries) {
    assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name), name);
    const path = "supabase/migrations/" + name;
    assert.deepEqual(checkFiscalAndSchemaScope([path]), [], name);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.fiscal_controls (id uuid)")[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("only audited atomic turma transfer migration passes the unchanged fiscal scanner", () => {
  const name = "20271031003000_bulk_turma_transfer_atomic.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  // Inspect the real migration rather than trusting a simulated harmless SQL string.
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20261104133501_bulk_turma_transfer_unreviewed.sql",
  ])[0] ?? "", /Unapproved database migration/);
  for (const sql of [
    "CREATE TABLE public.fiscal_ativacao (id uuid);",
    "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1 $;",
    "CREATE TABLE public.saft_export (id uuid);",
  ]) {
    assert.match(checkFiscalAndSchemaScope([path], () => sql)[0] ?? "",
      /Fiscal\/AGT activation marker/);
  }
});

test("audited transfer revocation and secondary history guard are narrowly allowlisted, not fiscal bypasses", () => {
  const approved = [
    "20271031004000_disable_legacy_transferir_matricula.sql",
    "20271031005000_guard_secondary_academic_transfer_evidence.sql",
  ];
  for (const name of approved) {
    const path = "supabase/migrations/" + name;
    assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name), name);
    // Validate actual SQL, not only a synthetic comment or fixture.
    assert.deepEqual(checkFiscalAndSchemaScope([path]), [], name);
    for (const statement of [
      "CREATE TABLE public.fiscal_config(enabled boolean);",
      "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $ SELECT 1 $;",
      "CREATE TABLE public.saft_export(id uuid);",
    ]) {
      assert.match(checkFiscalAndSchemaScope([path], () => statement)[0] ?? "",
        /Fiscal\/AGT activation marker/, name);
    }
  }
  for (const unreviewed of [
    "20271031005001_guard_secondary_academic_transfer_evidence.sql",
    "20271031006000_unreviewed_transfer.sql",
  ]) {
    assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + unreviewed])[0] ?? "",
      /Unapproved database migration/);
  }
});

test("payment-proof migration is the only newly authorized direct RPC protection", () => {
  const name = "20271112100000_rematricula_finalization_payment_guard.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  // New migrations remain prohibited without an explicit review, and fiscal
  // activation remains blocked even inside this narrowly authorized file.
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271112100001_unreviewed_payment_bypass.sql",
  ])[0] ?? "", /Unapproved database migration/);
  for (const sql of [
    "CREATE TABLE public.fiscal_activation (enabled boolean);",
    "CREATE OR REPLACE FUNCTION public.agt_issue_invoice() RETURNS void LANGUAGE sql AS $x$ SELECT 1 $x$;",
    "CREATE TABLE public.saft_export (id uuid);",
  ]) {
    assert.match(checkFiscalAndSchemaScope([path], () => sql)[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("student name correction migration is allowlisted only with the fiscal freeze enforced", () => {
  const name = "20271113090000_corrigir_nome_aluno_balcao.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271113090001_unreviewed_name_bypass.sql",
  ])[0] ?? "", /Unapproved database migration/);
  for (const sql of [
    "CREATE TABLE public.fiscal_config (enabled boolean);",
    "CREATE OR REPLACE FUNCTION public.agt_issue_invoice() RETURNS void LANGUAGE sql AS $x$ SELECT 1 $x$;",
    "CREATE TABLE public.saft_export (id uuid);",
  ]) {
    assert.match(checkFiscalAndSchemaScope([path], () => sql)[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("preserves the fiscal and AGT module freeze", () => {
  for (const path of [
    "apps/web/src/app/api/fiscal/activate/route.ts",
    "apps/web/src/app/api/agt/invoices/route.ts",
    "apps/web/src/lib/server/fiscal-engine.ts",
    "apps/web/src/lib/fiscal/processor.ts",
    "supabase/functions/agt-bridge/index.ts",
    "supabase/migrations/20261029000000_agt_saf_t.sql",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([path]).length > 0, `must reject ${path}`);
  }
});

test("rejects unexpected database migrations without weakening the guard", () => {
  const path = "supabase/migrations/20261029000000_other_database_change.sql";
  assert.match(checkFiscalAndSchemaScope([path])[0], /Unapproved database migration/);
});

test("rejects fiscal, SAF-T or AGT activation content inside an allowlisted migration", () => {
  for (const activation of [
    "CREATE TABLE public.fiscal_config (id uuid);",
    "CREATE TABLE public.agt_integrations (id uuid);",
    "CREATE TABLE public.saft_receipts (id uuid);",
    "ALTER TABLE public.faturas ADD COLUMN enabled boolean;",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([finalLifecycle], () => activation).length > 0, activation);
  }
});

test("does not conflate ordinary payment or RAA operations with fiscal activation", () => {
  assert.deepEqual(checkFiscalAndSchemaScope([
    "apps/web/src/lib/financeiro/recover-receipt-after-payment.ts",
    firstLifecycle,
  ], () => "UPDATE matriculas SET ativo = true WHERE status = 'ativo';"), []);
});

test("allows documentary comments but blocks actual fiscal activation SQL", () => {
  const migration = "supabase/migrations/20271029100000_lifecycle_reconciliation_evidence_guards.sql";
  assert.deepEqual(checkFiscalAndSchemaScope([migration], () => "-- Fiscal functions unchanged\nCREATE VIEW academic_history AS SELECT 1;"), []);
  assert.ok(checkFiscalAndSchemaScope([migration], () => "-- academic reconciliation\nCREATE TABLE public.fiscal_documentos (id uuid);").length > 0);
});

test("documentary RAA migrations are individually allowed but cannot activate fiscal scope", () => {
  const approved = [
    "20271109000000_raa_pendentes_via_academica.sql",
    "20271109010000_raa_historico_documental_ratificado.sql",
    "20271109015000_balcao_rematricula_fora_prazo_individual.sql",
    "20271109030000_balcao_notas_historicas_individuais.sql",
    "20271109020000_rematricula_preserva_origem_legal_fechada.sql",
    "20271109040000_balcao_historic_recovery_requests.sql",
    "20271109050000_balcao_rematricula_fora_epoca_direta.sql",
  ];
  for (const name of approved) {
    const path = "supabase/migrations/" + name;
    assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name), name);
    assert.deepEqual(checkFiscalAndSchemaScope([path]), [], name);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.fiscal_ativacao (id uuid);")[0] ?? "", /Fiscal\/AGT activation marker/);
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271109010001_unreviewed_history.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("calendar planning migration is narrowly allowed with RLS, audit and fiscal freeze", () => {
  const name = "20261119145630_calendario_avaliacoes_auditado_20261119.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE TABLE public.calendario_avaliacoes (id uuid);")[0] ?? "",
    /Reviewed evaluation calendar migration missing guard/);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE TABLE public.fiscal_config (id uuid);")[0] ?? "",
    /Reviewed evaluation calendar migration missing guard|Fiscal\/AGT activation/);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20261119110001_unreviewed_assessment_writer.sql"
  ])[0] ?? "", /Unapproved database migration/);
});

test("calendar overlap migration is exact, additive, guarded and already ledger-aligned", () => {
  const filename = "20261119150953_calendario_avaliacoes_evitar_sobreposicao.sql";
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(filename));
  assert.deepEqual(checkFiscalAndSchemaScope(["supabase/migrations/" + filename]), []);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/" + filename],
    () => "DROP TABLE public.calendario_avaliacoes;")[0] ?? "", /Assessment conflict guard/);
});

test("reviewed rematrícula cross-cycle RPC patch remains fiscal-frozen", () => {
  const file = "20271119121000_balcao_rematricula_transicoes_idempotentes.sql";
  const path = "supabase/migrations/" + file;
  assert.equal(LIFECYCLE_MIGRATION_ALLOWLIST.has(file), true);
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE TABLE public.fiscal_ativacao(enabled boolean);")[0] ?? "", /Fiscal[/]AGT activation/);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271119121001_unreviewed_reenrollment.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("calendar only accepts active current-year class and exact migration guard", () => {
  const filename = "20261119155654_calendario_avaliacoes_turma_ativa_20261119.sql";
  const path = "supabase/migrations/" + filename;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(filename));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "DROP TABLE public.turmas;")[0] ?? "", /Calendar active-class guard missing|Calendar active-class migration cannot change/);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20261119155655_unreviewed_calendar_writer.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("Curtume document review is the only new audited migration, never a fiscal bypass", () => {
  const name = "20271201090000_curtume_2025_documental_self_service.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () => "UPDATE public.notas SET valor=20;")[0] ?? "",
    /Reviewed Curtume document migration missing guard|Document review migration cannot rewrite/);
  assert.match(checkFiscalAndSchemaScope([path], () => "CREATE TABLE public.agt_fatura(id uuid);")[0] ?? "",
    /Reviewed Curtume document migration missing guard|Fiscal\/AGT activation/);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271201090001_unreviewed_notes_override.sql"])[0] ?? "",
    /Unapproved database migration/);
});

test("automatic historical close guards only the exact audited Curtume source", () => {
  const filename = "20271201100000_curtume_2025_autofecho_proteger_ano_documental.sql";
  const path = "supabase/migrations/" + filename;
  assert.equal(LIFECYCLE_MIGRATION_ALLOWLIST.has(filename), true);
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "UPDATE public.notas SET valor=20;")[0] ?? "",
    /Reviewed Curtume auto-close guard missing|Auto-close guard cannot rewrite/);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE TABLE public.agt_registro(id uuid);")[0] ?? "",
    /Reviewed Curtume auto-close guard missing|Fiscal\/AGT activation/);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271201100001_unapproved_close.sql"
  ])[0] ?? "", /Unapproved database migration/);
});

test("RAA successor activation is the sole additional reviewed migration", () => {
  const file = "20271201110000_raa_activation_guard_reconciled.sql";
  const path = "supabase/migrations/" + file;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(file));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "CREATE OR REPLACE FUNCTION public.unsafe() RETURNS void LANGUAGE sql AS $x$ SELECT 1 $x$;")[0] ?? "",
    /Reviewed RAA activation migration missing guard/);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "UPDATE public.notas SET valor=20;")[0] ?? "",
    /RAA activation gate cannot write grades|Reviewed RAA activation migration missing guard/);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271201110001_unreviewed_raa.sql"])[0] ?? "",
    /Unapproved database migration/);
});

test("timeline 360 security migration is the only newly reviewed RPC authorization patch", () => {
  const file = "20271202000000_guard_timeline_360_school_role.sql";
  const path = "supabase/migrations/" + file;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(file));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271202000001_unreviewed_timeline_bypass.sql"
  ])[0] ?? "", /Unapproved database migration/);

  for (const sql of [
    "CREATE OR REPLACE FUNCTION public.unsafe() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;",
    "UPDATE public.notas SET valor = 20;",
    "ALTER TABLE public.alunos DISABLE ROW LEVEL SECURITY;",
    "CREATE TABLE public.fiscal_config (enabled boolean);",
    "GRANT ALL ON public.historico_disciplinas TO authenticated;",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([path], () => sql).length > 0, sql);
  }

  // The policy also rejects a realistic patch with all required authorization
  // markers but with a surprise data mutation at the tail.
  const reviewed = readFileSync(path, "utf8");
  assert.match(checkFiscalAndSchemaScope([path], () =>
    reviewed.replace("COMMIT;", "UPDATE public.notas SET valor = 20;\nCOMMIT;")
  )[0] ?? "", /Timeline RPC migration cannot modify/);
});

test("PR #455: bolsa integral SSOT is the sole audited tuition migration without fiscal activation", () => {
  const name = "20271202030000_bolsa_integral_matricula_ssot.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  assert.match(
    checkFiscalAndSchemaScope(["supabase/migrations/20271202030001_unreviewed_bolsa.sql"])[0] ?? "",
    /Unapproved database migration/,
  );
  for (const unsafe of [
    "CREATE TABLE public.fiscal_config (enabled boolean);",
    "CREATE OR REPLACE FUNCTION public.agt_activate() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;",
    "ALTER TABLE public.mensalidades ADD COLUMN fiscal_enabled boolean;",
    "UPDATE public.mensalidades SET fiscal_documento_id = NULL;",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([path], () =>
      readFileSync(path, "utf8") + "\n" + unsafe
    ).some((issue) => issue.includes("Fiscal/AGT activation")), unsafe);
  }
  assert.ok(checkFiscalAndSchemaScope([path], () =>
    readFileSync(path, "utf8").replace(
      "CREATE OR REPLACE FUNCTION public.klasse_definir_bolsa_integral(",
      "-- removed audited RPC\n",
    )
  ).some((issue) => issue.includes("Bolsa SSOT reviewed migration missing guard")));
});

test("PR #455: autorização da bolsa usa bloco PL/pgSQL com delimitadores válidos", () => {
  const name = "supabase/migrations/20271202030000_bolsa_integral_matricula_ssot.sql";
  const migration = readFileSync(name, "utf8");
  const fnStart = migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.klasse_autorizar_escrita_bolsa_matricula()",
  );
  const fnEnd = migration.indexOf(
    "DROP TRIGGER IF EXISTS trg_03_autorizar_bolsa_matricula",
    fnStart,
  );
  assert.ok(fnStart > 0 && fnEnd > fnStart, "function boundaries must exist");
  const sql = migration.slice(fnStart, fnEnd);
  assert.match(sql, /AS \$\$\s+DECLARE/, "PL/pgSQL must open with $$");
  assert.match(sql, /END;\s*\$\$;/, "PL/pgSQL must close with $$;");
  assert.match(migration, /p\.percentagem_desconto < 100/);
  assert.match(migration, /AND NOT \(p\.bolsa_integral/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM public\.pagamentos pg/);
});

test("PR #477: operational receipt SSOT permits only the audited migration and preserves fiscal freeze", () => {
  const name = "20271204020000_operational_receipt_batch_ssot.sql";
  const path = "supabase/migrations/" + name;
  assert.ok(LIFECYCLE_MIGRATION_ALLOWLIST.has(name));
  assert.deepEqual(checkFiscalAndSchemaScope([path]), []);
  const reviewed = readFileSync(path, "utf8");
  for (const sql of [
    "UPDATE public.pagamentos SET valor_pago=1;",
    "UPDATE public.mensalidades SET status='pago';",
    "ALTER TABLE internal.operational_receipt_reconciliation DISABLE ROW LEVEL SECURITY;",
    "GRANT EXECUTE ON FUNCTION internal.issue_operational_batch_receipt(uuid,uuid) TO authenticated;",
    "CREATE TABLE public.fiscal_config(enabled boolean);",
  ]) assert.ok(checkFiscalAndSchemaScope([path], () => reviewed + "\n" + sql).length > 0, sql);
  assert.match(checkFiscalAndSchemaScope(["supabase/migrations/20271204020001_unreviewed_receipt.sql"])[0] ?? "", /Unapproved database migration/);
});
