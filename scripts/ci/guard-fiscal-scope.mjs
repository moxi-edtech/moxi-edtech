/**
 * Guard only the scope of receipt/enrollment PRs.
 *
 * Audited lifecycle, RAA and MED migrations are allowed, but fiscal/AGT/SAF-T activation
 * remains prohibited. Do not turn this into a blanket migration exception.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LIFECYCLE_MIGRATION_ALLOWLIST = new Set([
  "20261028211345_lifecycle_p0_revoke_legacy_writers_20261028.sql",
  "20261028211433_lifecycle_sync_status_ativo_20261028.sql",
  "20261028211533_lifecycle_history_ssot_view_20261028.sql",
  "20261028211752_lifecycle_fix_historico_session_and_final_gate_20261028.sql",
  "20261028211809_lifecycle_finalizar_blindada_result_authority_20261028.sql",
  "20261028212124_lifecycle_reconcile_unique_historical_link_20261028.sql",
  "20261028212242_lifecycle_matriculas_staff_write_rls_20261028.sql",
  "20261028212343_lifecycle_ssot_view_private_scope_20261028.sql",
  "20261028212414_lifecycle_ssot_view_dba_scope_20261028.sql",
  "20261028212425_lifecycle_aluno_activation_canonical_trigger_20261028.sql",
  "20261028214241_lifecycle_restrict_matricula_write_roles_20261028.sql",
  "20271027120000_lifecycle_ssot_post_replay_guard.sql",
  "20261029090749_lifecycle_gradeengine_missing_evidence_fail_closed_20261029.sql",
  "20261029091406_lifecycle_academic_decisions_and_legal_lock_guard_20261029.sql",
  "20261029091637_lifecycle_historical_outcomes_ratification_20261029.sql",
  "20271029100000_lifecycle_reconciliation_evidence_guards.sql",
  // Three migrations applied live plus the three full late replay migrations.
  // Allow each exact audited academic file, never arbitrary database changes.
  "20261029102650_curtume_class_metadata_and_transition_lineage_20261029.sql",
  "20261029103216_curtume_legal_history_destination_guard_20261029.sql",
  "20261029103555_curtume_turma_classe_number_consistency_20261029.sql",
  "20271029110000_curtume_class_metadata_and_transition_lineage.sql",
  "20271029120000_curtume_legal_history_destination_guard.sql",
  "20271029130000_curtume_turma_classe_number_consistency.sql",
  "20271029140000_global_academic_class_metadata_contract.sql",
  "20261029110413_global_academic_class_metadata_contract_20261029.sql",
  "20261029112728_enrollment_context_atomic_authorized_create_20261029.sql",
  "20271029150000_enrollment_context_atomic_authorized_create.sql",
  "20261029113302_enrollment_view_academic_year_ssot_20261029.sql",
  "20271029151000_enrollment_view_academic_year_ssot.sql",
  // Read-only contextual lifecycle projection; no student, grade, or finance writes.
  "20271029235900_lifecycle_contextual_status_ssot_v2.sql",
  // Live-applied, no-op migration ledger shims; full late replay remains gated.
  "20261029132302_lifecycle_contextual_status_ssot_v2.sql",
  "20261029132512_lifecycle_contextual_status_v2_select_only.sql",
  "20271029235910_lifecycle_persisted_status_contract_v3.sql",
  // PR #298: individually audited RAA permissions, grade-period protection
  // and canonical MED school/calendar schemas. The fiscal/AGT/SAF-T scanner
  // below still examines executable SQL in every allowlisted migration.
  "20271029235920_raa_balcao_authoritative_permissions.sql",
  "20271029235921_guard_grade_period_source_and_window.sql",
  "20271029235922_canonical_med_calendar_offering_profiles.sql",
  "20271029235923_apply_canonical_med_calendar_atomic.sql",
  // PR #303: role-scoped RLS for academic closure jobs only.
  "20271029235924_guard_fechamento_academico_jobs_rls.sql",
  // Global preset classification and authorized MED course installation.
  "20271029235926_global_curriculum_med_calendar_contract.sql",
  // Annual MED lineage and fail-closed academic year activation only.
  "20271029235927_med_annual_offering_profiles.sql",
  "20271029235928_med_year_activation_readiness.sql",
  "20271029235929_guard_med_initial_year.sql",
  "20271029235930_bootstrap_med_terms_on_new_school.sql",
  "20271029235931_cutover_activate_year_order.sql",
  // #299: decree provenance RPCs already applied independently; no fiscal/AGT changes.
  "20261029181138_official_decree_period_provenance_guard.sql",
  "20261029181554_preserve_legacy_2025_calendar_provenance_compatibility.sql",
  // PR #320: exact audited school-class transfer migrations. The legacy
  // transfer RPC is revoked; the additional academic evidence guard is
  // additive and contains no pupil-grade or fiscal data migration.
  // Retain explicit filenames: never allow *transfer*.sql wildcards.
  // Every listed file is still scanned for executable fiscal/AGT/SAF-T SQL.
  "20271031003000_bulk_turma_transfer_atomic.sql",
  "20271031004000_disable_legacy_transferir_matricula.sql",
  "20271031005000_guard_secondary_academic_transfer_evidence.sql",
  // PR #323: strictly scoped documentary RAA bridge (no fiscal writes).
  // Both are reviewed by the dedicated lifecycle guard and disposable PG tests.
  "20271109000000_raa_pendentes_via_academica.sql",
  "20271109010000_raa_historico_documental_ratificado.sql",
  "20271109015000_balcao_rematricula_fora_prazo_individual.sql",
  "20271109030000_balcao_notas_historicas_individuais.sql",
  "20271109020000_rematricula_preserva_origem_legal_fechada.sql",
  // PR #324: exact audited student-scoped recovery request; fiscal scope stays frozen.
  "20271109040000_balcao_historic_recovery_requests.sql",
  // Ação direta e auditada no Balcão; os bloqueios do RAA são preservados.
  "20271109050000_balcao_rematricula_fora_epoca_direta.sql",
  // Audited tenant-scoped permissions for the four authorised Balcão roles.
  // No fiscal schema or AGT module is changed; the SQL is still scanned below.
  "20271112010000_balcao_historic_full_staff_permissions.sql",
  // Scoped, reviewed EP 6th -> ESG 7th progression; no fiscal change.
  "20271112020000_balcao_primary_secondary_6_to_7.sql",
  // Pupil-specific prior-year turma selection for physical pauta grade transcription.
  "20271112030000_balcao_pauta_corrigir_turma_origem.sql",
  // Correção de erro de classe no mesmo ano, auditada, sem promoção nem alterações financeiras.
  "20271112040000_balcao_retificacao_classe_sem_progressao.sql",
  // Audited historical journey; no new financial tables or fabricated payments.
  "20271112050000_balcao_percurso_academico.sql",
  // School-scoped secretaria role aliases; no financial writer or data changes.
  "20271112060000_balcao_secretaria_role_aliases.sql",
  // PR #333: exact payment-evidence guard for the existing academic finalizer.
  // The no-AGT/SAF-T scanner still examines executable SQL in this file.
  "20271112100000_rematricula_finalization_payment_guard.sql",
  // PR #335: student name correction only; tenant, role and audit checks enforced by RPC.
  // This exact filename remains subject to the same fiscal/AGT/SAF-T SQL scanner.
  "20271113090000_corrigir_nome_aluno_balcao.sql",
  // Reviewed atomic reprice on class correction: only unpaid untouched monthly
  // entries may change. Fiscal/AGT/SAF-T scanner remains enforced.
  "20271116090000_balcao_retificacao_classe_repreco_pendentes.sql",
  // PR: exclusively reviewed RAA historical final-cycle/annulled-target repair.
  "20271117173000_raa_historical_finalists_and_voided_destinations.sql",
  // One exact reviewed 2025/CURTUME batch; fiscal/AGT writers remain denied.
  "20271117190000_curtume_fechar_pautas_2025_lote.sql",
  // Exact CURTUME 2025 documentary/operational-grade reconciliation; fiscal scanner unchanged.
  "20271117230000_curtume_2025_signed_operational_grades_reconciliation.sql",
  // Curtume 2025: only exact signed batch/conference role expansions.
  // Tenant, provenance, signed actor, RAA, and fiscal prohibitions stay intact.
  "20271118090000_curtume_2025_lote_admin_financeiro.sql",
  // PR #370: integridade da identidade de avaliação curricular no INSERT,
  // sem notas, sem dados históricos e sem mudanças fiscais/AGT/SAF-T.
  // O mesmo scanner de SQL executável continua activo.
  "20271118120000_guard_turma_assessment_identity_install.sql",
  // Reviewed CURTUME 2025 legal-close diagnostics only; fiscal freeze remains active.
  "20271118130000_curtume_2025_persist_fecho_diagnostics.sql",
  // PR #374: matrícula desistente, sinalização docente e RLS por escola.
  // Apenas esta migração auditada; fiscal/AGT/SAF-T continua bloqueado.
  "20271119090000_matricula_desistencia_operacional_v1.sql",
  // Reativação auditada; status ativo somente pela RPC autorizada, sem fiscal.
  "20271119093000_matricula_desistencia_reativacao_v2.sql",
  // PR #434: exact CURTUME academic document review (signed provenance and PG17).
  // The existing executable SQL fiscal/AGT/SAF-T scanner is unchanged.
  "20271201090000_curtume_2025_documental_self_service.sql",
  // Curated Curtume 2025 automatic-closure guard only, no grade/finance write.
  // Existing fiscal and SQL content scanner continues to apply to this exact file.
  "20271201100000_curtume_2025_autofecho_proteger_ano_documental.sql",
  // Reconciled #344: enforce canonical RAA before activating successor enrollment.
  "20271201110000_raa_activation_guard_reconciled.sql",
  // SEC-ACADEMIC-360: one reviewed read-only RPC authorization hardening only.
  // No fiscal, academic-grade, enrollment, or historical data writes allowed.
  "20271202000000_guard_timeline_360_school_role.sql",
  // PR #455: bolsa integral SSOT por matrícula e proteção de mensalidades.
  // Ficheiro exato, sujeito aos mesmos bloqueios AGT/SAF-T/fiscal.
  "20271202030000_bolsa_integral_matricula_ssot.sql",
  // PR #379: migração de rematrícula entre ciclos sem mudanças fiscais.
  "20271119121000_balcao_rematricula_transicoes_idempotentes.sql",
  // PR #378: calendário escolar operacional; RLS e auditoria append-only, sem notas ou fiscal.
  "20261119145630_calendario_avaliacoes_auditado_20261119.sql",
  "20261119150953_calendario_avaliacoes_evitar_sobreposicao.sql",
  // Calendário: validação exclusiva de turma ativa e ano corrente; sem alterações de matrícula ou notas.
  "20261119155654_calendario_avaliacoes_turma_ativa_20261119.sql",
]);

const FISCAL_PATH = /^(?:apps\/web\/src\/(?:app\/api\/(?:fiscal|agt)(?:\/|\.|-|$)|lib\/(?:server\/)?(?:fiscal|agt)(?:\/|\.|-|$))|supabase\/(?:functions\/[^/]*(?:fiscal|agt|saft)|migrations\/[^/]*(?:fiscal|agt|saft)))/i;
// Prevent fiscal activation hidden inside an allowlisted academic migration.
// Ordinary references to finance/payment are not fiscal engine activation.
const FISCAL_SQL = /\b(?:AGT|SAF[-_]?T|SAFT|fiscal(?:iza(?:c|ç)[aã]o)?|fatur(?:a(?:ç|c)[aã]o|as?)|factur(?:a(?:ç|c)[aã]o|as?))(?=[^a-z0-9]|$)/i;

export function checkFiscalAndSchemaScope(paths, readMigration = (path) => readFileSync(path, "utf8")) {
  const violations = [];
  for (const path of paths) {
    if (!path) continue;
    if (FISCAL_PATH.test(path)) {
      violations.push(`Fiscal/AGT module change prohibited: ${path}`);
      continue;
    }
    if (!path.startsWith("supabase/migrations/")) continue;

    const name = path.slice("supabase/migrations/".length);
    if (!LIFECYCLE_MIGRATION_ALLOWLIST.has(name)) {
      violations.push(`Unapproved database migration in this workflow: ${path}`);
      continue;
    }

    const content = readMigration(path);
    // Comments are documentation, not executable SQL.
    // Scan executable SQL to prevent hidden fiscal activation.
    const executableSql = content.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Aprovar exclusivamente este esquema revisto: sem permissões amplas,
    // sem desativar RLS e sem escrever em notas, matrículas ou financeiro.
    if (name === "20261119145630_calendario_avaliacoes_auditado_20261119.sql") {
      const expected = [
        "CREATE TABLE IF NOT EXISTS public.calendario_avaliacoes (",
        "CREATE TABLE IF NOT EXISTS public.calendario_avaliacoes_auditoria (",
        "ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY calendario_avaliacoes_gestao",
        "CREATE POLICY calendario_avaliacoes_alunos",
        "CREATE POLICY calendario_avaliacoes_professor",
        "CREATE POLICY calendario_avaliacoes_auditoria_gestao",
        "current_tenant_escola_id()",
        "user_has_role_in_school",
        "m.ativo IS TRUE",
        "to_jsonb(OLD)",
        "to_jsonb(NEW)",
        "CREATE TRIGGER trg_calendario_avaliacoes_audit",
        "CREATE OR REPLACE FUNCTION public.publicar_calendario_avaliacoes",
        "FOR UPDATE",
        "REVOKE ALL ON public.calendario_avaliacoes_auditoria",
        "GRANT SELECT ON public.calendario_avaliacoes_auditoria TO authenticated",
      ];
      for (const token of expected) {
        if (!content.includes(token)) {
          violations.push("Reviewed evaluation calendar migration missing guard: " + token);
        }
      }
      if (/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:notas|avaliacoes|matriculas|pagamentos|mensalidades|financeiro_\w+)\b/i.test(executableSql)) {
        violations.push("Evaluation calendar migration cannot mutate grade, enrollment or finance tables: " + path);
      }
    }

    if (name === "20261119150953_calendario_avaliacoes_evitar_sobreposicao.sql") {
      for (const token of ["ALTER TABLE public.calendario_avaliacoes", "EXCLUDE USING gist", "turma_id WITH =", "tsrange(", "WHERE (estado <> 'cancelado')"]) {
        if (!content.includes(token)) violations.push("Assessment conflict guard missing: " + token);
      }
      if (/(?:DROP\s|TRUNCATE\s|DISABLE\s|INSERT\s|UPDATE\s|DELETE\s)/i.test(executableSql)) {
        violations.push("Assessment conflict migration may only install the exclusion constraint: " + path);
      }
    }
    if (name === "20261119155654_calendario_avaliacoes_turma_ativa_20261119.sql") {
      for (const token of [
        "CREATE OR REPLACE FUNCTION public.calendario_avaliacoes_turma_ativa_guard()",
        "SECURITY INVOKER",
        "t.ano_letivo_id = NEW.ano_letivo_id",
        "t.session_id = NEW.ano_letivo_id",
        "t.status_validacao = 'ativo'",
        "a.ativo IS TRUE",
        "CALENDARIO_TURMA_INATIVA_OU_ANO_INCORRETO",
        "REVOKE ALL ON FUNCTION public.calendario_avaliacoes_turma_ativa_guard()",
        "CREATE TRIGGER trg_calendario_avaliacoes_turma_ativa",
      ]) {
        if (!content.includes(token)) violations.push("Calendar active-class guard missing: " + token);
      }
      if (/(?:DROP\s+TABLE|TRUNCATE\s|ALTER\s+TABLE|INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)/i.test(executableSql)) {
        violations.push("Calendar active-class migration cannot change table data or schema: " + path);
      }
    }
    if (name === "20271201090000_curtume_2025_documental_self_service.sql") {
      // Don't silently turn a school-document review into any grade mutation or
      // a privileged bypass. Preserve the fiscal/AGT/SAF-T scanner below.
      for (const token of [
        "CREATE TABLE IF NOT EXISTS internal.curtume_2025_documento_revisoes",
        "ENABLE ROW LEVEL SECURITY",
        "REVOKE ALL ON TABLE internal.curtume_2025_documento_revisoes",
        "CREATE OR REPLACE FUNCTION public.curtume_2025_documentos_pendentes",
        "CREATE OR REPLACE FUNCTION public.curtume_2025_confirmar_pauta_documental",
        "pg_catalog.md5(v_body)",
        "CURTUME_2025_FUNCTION_BASELINE_DRIFT",
        "CURTUME_2025_FUNCTION_PATCH_PATTERN_DRIFT",
        "CONFIRMO_PAUTA_2025_2026",
        "ON CONFLICT (historico_disciplina_id,fonte_sha256) DO NOTHING",
      ]) {
        if (!content.includes(token)) {
          violations.push("Reviewed Curtume document migration missing guard: " + token);
        }
      }
      if (/(?:TRUNCATE|DISABLE\s+TRIGGER|(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+public\.(?:notas|matriculas|historico_anos|historico_disciplinas|pagamentos|mensalidades)\b)/i.test(executableSql)) {
        violations.push("Document review migration cannot rewrite historical, grade or financial data: " + path);
      }
    }

    if (name === "20271201100000_curtume_2025_autofecho_proteger_ano_documental.sql") {
      for (const token of [
        "CURTUME_2025_BATCH_SOURCE_DRIFT",
        "CURTUME_2025_BATCH_PATCH_ANCHOR_DRIFT",
        "pg_catalog.md5(v_original)",
        "PAUTA_ANO_DIVERGENTE_EXIGE_CONFERENCIA",
        "pg_catalog.replace(v_definition,v_old,v_new)",
      ]) {
        if (!content.includes(token)) {
          violations.push("Reviewed Curtume auto-close guard missing: " + token);
        }
      }
      if (/(?:TRUNCATE|DISABLE\s+TRIGGER|(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:notas|matriculas|historico_anos|historico_disciplinas|pagamentos|mensalidades)\b)/i.test(executableSql)) {
        violations.push("Auto-close guard cannot rewrite school, grade or financial data: " + path);
      }
    }

    if (name === "20271202000000_guard_timeline_360_school_role.sql") {
      // Only allow the existing dossier timeline RPC to gain internal
      // identity + role + student-school checks. The function's SELECT
      // body and its exact grants remain subject to this narrow gate.
      for (const token of [
        "CREATE OR REPLACE FUNCTION public.get_aluno_timeline_360(",
        "RETURNS jsonb",
        "LANGUAGE plpgsql",
        "SECURITY DEFINER",
        "auth.uid() IS NULL",
        "public.user_has_role_in_school(",
        "a.id = p_aluno_id",
        "a.escola_id = p_escola_id",
        "USING ERRCODE = '42501'",
        "REVOKE EXECUTE ON FUNCTION public.get_aluno_timeline_360(uuid, uuid) FROM PUBLIC, anon",
        "GRANT EXECUTE ON FUNCTION public.get_aluno_timeline_360(uuid, uuid) TO authenticated, service_role",
      ]) {
        if (!content.includes(token)) violations.push("Reviewed timeline RPC migration missing guard: " + token);
      }
      if (content.indexOf("user_has_role_in_school(") > content.indexOf("RETURN (")
        || content.indexOf("a.escola_id = p_escola_id") > content.indexOf("RETURN (")) {
        violations.push("Timeline RPC authorization must execute before selecting student data: " + path);
      }
      if (/(?:\b(?:INSERT\s+INTO|UPDATE\s+(?:public\.)?[a-z_]+\s+SET|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+(?:TABLE|FUNCTION|POLICY|TRIGGER)|DISABLE\s+TRIGGER|GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)|REVOKE\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE))\b)/i.test(executableSql)
        || /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?!public\.get_aluno_timeline_360\s*\()/i.test(executableSql)) {
        violations.push("Timeline RPC migration cannot modify other functions, schema, enrollment, grades or finance: " + path);
      }
    }

    if (name === "20271201110000_raa_activation_guard_reconciled.sql") {
      for (const token of [
        "RAA_ACTIVATION_DEPENDENCY_DRIFT",
        "RAA_ACTIVATION_TRIGGER_ALREADY_EXISTS",
        "resolve_raa_progression_for_matricula(",
        "NEW.origem_transicao_matricula_id",
        "trg_klasse_guard_enrollment_raa_progression",
        "REVOKE ALL ON FUNCTION public.guard_enrollment_raa_progression_v1()",
      ]) {
        if (!content.includes(token)) {
          violations.push("Reviewed RAA activation migration missing guard: " + token);
        }
      }
      if (/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+public\.(?:notas|historico_anos|historico_disciplinas|pagamentos|mensalidades)/i.test(executableSql)) {
        violations.push("RAA activation gate cannot write grades, historical data or payments: " + path);
      }
    }

    // PR #455: a consulta da coluna histórica fiscal_documento_id IS NULL
    // impede que a isenção altere um título já fiscalizado. Essa leitura
    // defensiva NÃO é ativação do módulo fiscal; qualquer outra referência
    // a fiscal/AGT/SAF-T continua proibida.
    let sqlForFiscalScan = executableSql;
    if (name === "20271202030000_bolsa_integral_matricula_ssot.sql") {
      for (const token of [
        "ADD COLUMN IF NOT EXISTS bolsa_integral boolean NOT NULL DEFAULT false",
        "CREATE OR REPLACE FUNCTION public.klasse_guard_bolsa_mensalidade()",
        "CREATE OR REPLACE FUNCTION public.klasse_reconciliar_bolsa_matricula()",
        "CREATE OR REPLACE FUNCTION public.klasse_autorizar_escrita_bolsa_matricula()",
        "CREATE OR REPLACE FUNCTION public.klasse_definir_bolsa_integral(",
        "CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(",
        "REVOKE ALL ON FUNCTION public.klasse_definir_bolsa_integral",
        "WHERE eu.escola_id = p_escola_id",
        "WHERE id = p_matricula_id AND escola_id = p_escola_id",
        "coalesce(me.valor_pago_total, 0) = 0",
        "me.fiscal_documento_id IS NULL",
      ]) {
        if (!content.includes(token)) {
          violations.push("Bolsa SSOT reviewed migration missing guard: " + token);
        }
      }
      sqlForFiscalScan = executableSql.replace(
        /\b(?:NEW|me)\.fiscal_documento_id\s+IS\s+(?:NOT\s+)?NULL\b/gi, "");
    }
    if (FISCAL_SQL.test(sqlForFiscalScan)) {
      violations.push(`Fiscal/AGT activation marker in lifecycle migration: ${path}`);
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base || !/^origin\/[\w./-]+$/.test(base)) {
    console.error("Usage: node scripts/ci/guard-fiscal-scope.mjs origin/main");
    process.exit(2);
  }
  const changed = execFileSync("git", ["diff", "--name-only", "-z", `${base}...HEAD`], {
    encoding: "utf8",
  }).split("\0").filter(Boolean);
  const errors = checkFiscalAndSchemaScope(changed);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("Fiscal/AGT/SAF-T unchanged; only explicitly audited academic migrations allowed.");
}
