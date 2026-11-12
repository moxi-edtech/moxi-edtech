import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveStudentYearSituation, hasHistoricalPending, type SituacaoBalcaoPayload, type SituacaoBalcaoRow } from "../../src/lib/balcao/student-year-situation";

const row = (year: number, status: SituacaoBalcaoRow["situacao_contextual"],
  resultado: SituacaoBalcaoRow["situacao_resultado"] = "sem_resultado_oficial"): SituacaoBalcaoRow => ({
  matricula_id: "matricula-" + year, escola_id: "escola", aluno_id: "aluno",
  ano_letivo: year, ano_letivo_id: "ano-" + year, turma_id: "turma-" + year,
  status_persistido: status === "matriculado" ? "ativo" : "pendente",
  situacao_contextual: status, situacao_resultado: resultado,
  acao_contextual: "conciliar_historico", resultado_oficial: resultado === "homologado" ? "aprovado" : null,
});
const payload = (current: SituacaoBalcaoRow | null, previous: SituacaoBalcaoRow | null = null,
  active = true): SituacaoBalcaoPayload => ({
  ok: true, aluno_id: "aluno",
  ano: { id: "ano-2026", ano: 2026, label: "2026/2027", ativo: active, arquivado_com_pendencias: !active },
  current, previous, can_write_current_grades: true,
  editable_historical_matricula_id: null,
  historical_evaluation_scale: null,
});

test("existing current enrollment never requires a fabricated prior-year enrollment", () => {
  const situacao = resolveStudentYearSituation(payload(row(2026, "matriculado")));
  assert.match(situacao.title, /Matriculado/);
  assert.equal(situacao.action, "grade");
});

test("a student without 2026 enrollment must resolve the last year's real academic blocker first", () => {
  const situacao = resolveStudentYearSituation(payload(null, row(2025, "regularizacao_historica")));
  assert.equal(situacao.title, "Histórico de 2025 por regularizar");
  assert.equal(situacao.action, "historical");
  assert.equal(situacao.actionLabel, "Resolver histórico de 2025");
  assert.ok(hasHistoricalPending(payload(null, row(2025, "regularizacao_historica"))));
});

test("historic pending and enrolled destination coexist; neither is silently approved", () => {
  const state = payload(row(2026, "matriculado"), row(2025, "regularizacao_historica"));
  assert.equal(resolveStudentYearSituation(state).action, "grade");
  assert.equal(hasHistoricalPending(state), true);
  assert.equal(state.previous?.situacao_resultado, "sem_resultado_oficial");
});

test("closed previous year with unhomologated result still offers historical resolution", () => {
  assert.equal(hasHistoricalPending(payload(row(2026, "matriculado"), row(2025, "ano_encerrado", "registado_nao_homologado"))), true);
  assert.equal(hasHistoricalPending(payload(row(2026, "matriculado"), row(2025, "ano_encerrado", "homologado"))), false);
});

test("archived year forbids normal grade entry even with operationally active enrollment", () => {
  assert.equal(resolveStudentYearSituation(payload(row(2026, "matriculado"), null, false)).action, "profile");
});

test("pending current enrollment is resumed, never duplicated", () => {
  const situacao = resolveStudentYearSituation(payload(row(2026, "aguarda_confirmacao")));
  assert.equal(situacao.action, "profile");
  assert.equal(situacao.actionLabel, "Rever matrícula existente");
  assert.match(situacao.description, /sem criar outra matrícula/);
});

test("historic archive and completed year do not imply official academic approval", () => {
  const data = payload(row(2025, "regularizacao_historica"), null, false);
  assert.equal(resolveStudentYearSituation(data).action, "historical");
  assert.equal(resolveStudentYearSituation(payload(row(2025, "ano_encerrado"), null, false)).action, "historical");
  assert.equal(resolveStudentYearSituation(payload(row(2025, "ano_encerrado", "homologado"), null, false)).action, "profile");
});

test("transferred or inconsistent enrollment offers review, not reenrollment by assumption", () => {
  assert.equal(resolveStudentYearSituation(payload(row(2026, "transferido"))).action, "profile");
  assert.equal(resolveStudentYearSituation(payload(row(2026, "revisao_integridade"))).action, "profile");
});

test("server enforces tenant, user, selected academic year, RLS view and no-store", () => {
  const src = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/situacao-academica/route.ts"), "utf8");
  for (const guard of [
    "resolveEscolaIdForUser", "requireRoleInSchool", "resolveAcademicYearContext",
    'from("v_student_lifecycle_status_v2")', '.eq("escola_id", escolaId)',
    '.eq("aluno_id", alunoId)', "DUPLICATE_YEAR_ENROLLMENT", 'force-dynamic',
    'Cache-Control', "authorizeTurmasManage",
  ]) assert.ok(src.includes(guard), guard + " must be present");
  assert.doesNotMatch(src, /service.role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Balcao navigates by current year and suppresses misleading origin-only screen", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  assert.match(src, /useBalcaoSituacaoAcademica/);
  assert.match(src, /<BalcaoSituacaoAcademica/);
  assert.doesNotMatch(src, /view !== "reenrollment" \|\| Boolean\(dossier\.aluno\.matricula_id\)/);
  assert.match(src, /<Catalogo/);
  assert.doesNotMatch(src, /!dossier\.aluno\.matricula_id \? "SOURCE_RECORD_REQUIRED"/);
  assert.match(src, /historicalMatriculaId: row\.matricula_id/);
});

test("historic year correction reuses existing audited note modal, not the transited-history writer", () => {
  const ui = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const balc = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/situacao-academica/route.ts"), "utf8");
  assert.match(ui, /onHistoricalGrade\(historicalTarget\)/);
  assert.match(ui, /Abrir pauta de \{previous\.ano_letivo\}/);
  assert.match(ui, /<BalcaoHistoricalAcademicRecovery/);
  assert.doesNotMatch(ui, /DossierHistoricoTransitadoSection/);
  assert.match(balc, /historicalMatriculaId: row\.matricula_id/);
  assert.match(route, /editable_historical_matricula_id/);
  assert.match(route, /authorizeBalcaoPendingAcademicWrite/);
  assert.match(route, /canWritePending && activeYear !== null/);
});

test("contextual read grants the same staff roles as the existing historic grade reader", () => {
  const src = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/situacao-academica/route.ts"), "utf8");
  assert.match(src, /"admin_secretaria"/);
  assert.match(src, /"diretor"/);
  assert.match(src, /"admin_financeiro"/);
  assert.match(src, /canWriteAcademic \|\| canManageTurmas\.allowed/);
  assert.match(src, /authorizeBalcaoPendingAcademicWrite/);
});

test("historical grade edit uses one selected student, a real source enrollment and audited RPC", () => {
  const modal = readFileSync(resolve(process.cwd(), "src/components/secretaria/EnrollmentPostActionModal.tsx"), "utf8");
  const writer = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/notas/route.ts"), "utf8");
  const grid = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/turmas/[id]/pauta-grid/route.ts"), "utf8");
  const history = readFileSync(resolve(process.cwd(), "src/components/aluno/DossierHistoricoTransitadoSection.tsx"), "utf8");
  assert.match(modal, /historical_matricula_id: historicalMatriculaId/);
  assert.match(modal, /historical_motivo: motivoHistorico/);
  assert.match(writer, /lancar_nota_historica_individual/);
  assert.match(writer, /\.eq\('escola_id', escolaId\)/);
  assert.match(writer, /\.eq\('aluno_id', body\.notas\[0\]\.aluno_id\)/);
  assert.match(writer, /authorizeBalcaoPendingAcademicWrite/);
  assert.match(grid, /\.eq\('aluno_id', parsed\.data\.alunoId\)/);
  assert.match(grid, /\.\.\.\(canPreviewPending \? \['pendente'\] : \[\]\)/);
  // Do not use the separate, transited-history writer for real grade corrections.
  assert.match(history, /historico-transitado/);
  assert.doesNotMatch(writer, /upsert_historico_transitado/);
});

test("academic state is cached independently per school, pupil and selected year", () => {
  const ui = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const workspace = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  assert.match(ui, /escolaId \+ ":" \+ alunoId \+ ":" \+ anoLetivoId/);
  assert.match(workspace, /escolaId, dossier\.aluno\?\.id \?\? null, effectiveAcademicYearId/);
  assert.match(workspace, /void situacaoAcademica\.refresh\(\)/);
});

test("qualitative source cannot open numeric historical grades and routes to actual academic evidence review", () => {
  const api = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/situacao-academica/route.ts"), "utf8");
  const ui = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  assert.match(api, /rpc\("resolve_regime_academico"/);
  assert.match(api, /"quantitativa_primario", "quantitativa_secundario"/);
  assert.match(api, /historical_evaluation_scale: historicalCandidate/);
  assert.match(ui, /historicalIsQualitative/);
  assert.match(ui, /Validar avaliação qualitativa de/);
  assert.match(ui, /onClick=\{openHistoricalReview\}/);
  assert.match(ui, /historicalReviewTarget\.matricula_id/);
  assert.doesNotMatch(ui, /upsert_historico_transitado/);
});

test("previous-year documentary review remains mounted and reachable without a duplicate new panel", () => {
  const workspace = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  const context = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  assert.match(workspace, /historicalRecovery && raaMatriculaId && view !== "reenrollment"/);
  assert.match(context, /<BalcaoHistoricalAcademicRecovery/);
  assert.match(context, /matriculaId=\{historicalReviewTarget\.matricula_id\}/);
  assert.doesNotMatch(context, /getElementById\("balcao-historical-recovery-existing"\)/);
  assert.doesNotMatch(context, /onNavigate\?\.\("profile"\);\s*\};/);
});

test("a current enrollment without a prior-year origin retains the same operational panel", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  assert.doesNotMatch(src, /\(view !== "reenrollment" \|\| Boolean\(dossier\.aluno\.matricula_id\)\)/);
  assert.match(src, /<Catalogo/);
  assert.match(src, /view === "reenrollment"\s*\? null \/\/ No prior enrollment is not an error/);
  assert.match(src, /!situacaoAcademica\.data\.current &&\s*!situacaoAcademica\.data\.previous/);
});

test("historical documentary review is tied to selected enrollment, not optional Catalogo anchor", () => {
  const component = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  assert.match(component, /const historicalReviewTarget = previousPending && previous\?\.matricula_id/);
  assert.match(component, /setReviewOpenFor\(historicalReviewTarget\.matricula_id\)/);
  assert.match(component, /reviewOpenFor === historicalReviewTarget\.matricula_id/);
  assert.match(component, /matriculaId=\{historicalReviewTarget\.matricula_id\}/);
  assert.match(component, /onRecheck=\{async \(\) => \{ await refresh\(\); await onAcademicUpdated\?\.\(\); \}\}/);
  assert.doesNotMatch(component, /getElementById\("balcao-historical-recovery-existing"\)/);
});

test("RAA disciplines have names and source-matricula matching before showing their actions", () => {
  const workspace = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  const component = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  assert.match(workspace, /pendingSourceMatriculaId=\{rematricula\.academic\?\.source\?\.matricula_id/);
  assert.match(workspace, /disciplina_ids_pendentes \?\? \[\]/);
  assert.match(workspace, /disciplina_names\?\.\[id\]/);
  assert.match(component, /row\?\.matricula_id === pendingSourceMatriculaId/);
  assert.match(component, /Disciplinas pendentes/);
  assert.match(component, /onHistoricalGrade\(historicalTarget, item\.id\)/);
  assert.match(component, /onCurrentGrade\(current, item\.id\)/);
  assert.doesNotMatch(component, /Disciplinas em falta \(/);
});

test("case with no 2026 matrícula and no official 2025 result follows one documented academic recovery, not new intake", () => {
  const origin = row(2025, "regularizacao_historica");
  origin.status_persistido = "pendente";
  origin.resultado_oficial = null;
  const first = payload(null, origin);
  first.editable_historical_matricula_id = origin.matricula_id;
  const state = resolveStudentYearSituation(first);
  assert.equal(state.action, "historical");
  assert.equal(hasHistoricalPending(first), true);

  // After documenting the result but before legal closure, the next step is
  // ratification / closure in the same historic recovery.
  origin.situacao_contextual = "ano_encerrado";
  origin.situacao_resultado = "registado_nao_homologado";
  assert.equal(resolveStudentYearSituation(first).action, "historical");
  assert.equal(hasHistoricalPending(first), true);

  // The legal outcome, not the new year alone, controls the next action.
  origin.situacao_resultado = "homologado";
  origin.resultado_oficial = "aprovado";
  assert.equal(hasHistoricalPending(first), false);
  assert.equal(resolveStudentYearSituation(first).action, "reenrollment");
  assert.match(resolveStudentYearSituation(first).actionLabel ?? "", /Continuar matrícula de 2026/);

  origin.resultado_oficial = "reprovado";
  assert.equal(resolveStudentYearSituation(first).action, "reenrollment",
    "repeat/retention goes to the backend eligibility engine, never assumed approved");
  origin.resultado_oficial = "concluido";
  assert.equal(resolveStudentYearSituation(first).action, "profile",
    "cycle completion never creates a synthetic next-year matrícula");
});

test("historical workflow is visible from selected student, survives pre-homologation refresh, and never duplicates requests", () => {
  const component = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const recovery = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx"), "utf8");
  const service = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts"), "utf8");
  assert.match(component, /reviewOpenFor === historicalReviewTarget\.matricula_id/);
  assert.match(component, /onRecheck=\{async \(\) => \{ await refresh\(\); await onAcademicUpdated\?\.\(\); \}\}/);
  assert.match(recovery, /snapshot\.pedido_regularizacao \? \(/);
  assert.match(recovery, /Pedido de revisão recebido/);
  assert.match(recovery, /stage === "decisao" \? "Guardar resultado" : stage === "ratificacao" \? "Confirmar resultado" : "Concluir histórico"/);
  assert.match(service, /tem_notas_reais: temNotasLancadas/);
  assert.match(recovery, /snapshot\.tem_notas_reais === false/);
  assert.match(recovery, /!snapshot\.permite_escrita/);
  assert.match(service, /const ExactHistoricalDecisionRoles/);
});

test("2026 continuation is one click only when backend says READY, not merely when 2025 is homologated", () => {
  const component = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const workspace = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  assert.match(component, /snapshot\.ano\.ativo && canContinueEnrollment && onContinueEnrollment/);
  assert.match(component, /onContinueEnrollment\(\);/);
  assert.match(workspace, /rematricula\.cardState === "READY"/);
  assert.match(workspace, /rematricula\.anoLetivo\?\.id === effectiveAcademicYearId/);
  assert.match(workspace, /rematricula\.academic\?\.source\?\.matricula_id === situacaoAcademica\.data\?\.previous\?\.matricula_id/);
  assert.match(workspace, /situacaoAcademica\.data\?\.aluno_id === dossier\.aluno\.id/);
  assert.match(workspace, /onContinueEnrollment=\{rematricula\.openModal\}/);
  assert.doesNotMatch(component, /onNavigate\?\.\("enrollment"\)/);
});

test("non-final 7th grade cannot be marked as end of cycle in documentary UI or its server POST", () => {
  const recovery = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx"), "utf8");
  const server = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts"), "utf8");
  assert.match(server, /function allowsCycleCompletion/);
  assert.match(server, /\[6, 9, 12\]\.includes\(classe\)/);
  assert.match(server, /if \(body\.resultado_confirmado === "concluido"\)/);
  assert.match(server, /if \(!allowsCycleCompletion\(regime\)\)/);
  assert.match(server, /ACADEMIC_CYCLE_NOT_FINAL/);
  assert.match(server, /permite_conclusao_ciclo: allowsCycleCompletion\(sourceRegime\)/);
  assert.match(recovery, /snapshot\.permite_conclusao_ciclo &&/);
  assert.match(recovery, /<option value="concluido">/);
});

test("Bernarndo 2026 happy path opens the verified 2025 pauta in one click, retaining his original enrollment", () => {
  // Canonical situation: 2026 without a matrícula, 2025 pending in class 7
  // with no official result. This fixture has no personal or production IDs.
  const historical = row(2025, "regularizacao_historica");
  historical.status_persistido = "pendente";
  historical.situacao_resultado = "sem_resultado_oficial";
  const situationData = payload(null, historical);
  situationData.editable_historical_matricula_id = historical.matricula_id;
  assert.equal(resolveStudentYearSituation(situationData).action, "historical");

  const ui = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const workspace = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  const modal = readFileSync(resolve(process.cwd(), "src/components/secretaria/EnrollmentPostActionModal.tsx"), "utf8");
  assert.match(ui, /case "historical":\s*[\s\S]*?if \(historicalTarget\) onHistoricalGrade\(historicalTarget\);\s*else openHistoricalReview\(\);/);
  assert.doesNotMatch(ui, /historicalTarget\.matricula_id === current\?\.matricula_id/);
  assert.match(ui, /\? "Abrir pauta de " \+ historicalTarget\.ano_letivo/);
  assert.match(ui, /previousYearReady && situation\.action !== "historical"/,
    "the primary CTA must not be duplicated for this case");
  assert.match(ui, /Validar resultado de \{historicalReviewTarget\.ano_letivo\}/);
  assert.match(workspace, /currentSnapshot\.editable_historical_matricula_id !== row\.matricula_id/);
  assert.match(workspace, /row\.aluno_id !== dossier\.aluno\.id/);
  assert.match(workspace, /row\.escola_id !== escolaId/);
  assert.match(workspace, /historicalMatriculaId: row\.matricula_id/);
  assert.match(workspace, /originAnoLetivoId: row\.ano_letivo_id/);
  assert.match(modal, /alunoId,/);
  assert.match(modal, /pauta-grid\?/);
  assert.match(modal, /alunoId,/);
  assert.match(modal, /historical_matricula_id: historicalMatriculaId/);
  assert.match(modal, /onAcademicSaved\?\.\(\)/);
});

test("the 2025 archived-period message no longer claims reopening is required for audited historical correction", () => {
  const modal = readFileSync(resolve(process.cwd(), "src/components/secretaria/EnrollmentPostActionModal.tsx"), "utf8");
  assert.match(modal, /periodClosed && !historicalMatriculaId/);
  assert.match(modal, /originAnoLetivoId/);
  assert.match(modal, /"Período encerrado\. O lançamento normal exige reabertura autorizada/);
  assert.match(modal, /read_only === true && !historicalMatriculaId/);
});

test("concise school workflows use specific buttons, not generic compliance instructions", () => {
  const situation = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoSituacaoAcademica.tsx"), "utf8");
  const recovery = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx"), "utf8");
  const modal = readFileSync(resolve(process.cwd(), "src/components/secretaria/EnrollmentPostActionModal.tsx"), "utf8");
  assert.match(situation, /Abrir pauta de/);
  assert.match(situation, /Validar resultado de/);
  assert.match(situation, /Disciplinas pendentes/);
  assert.doesNotMatch(situation, /Disciplinas sinalizadas pelo RAA/);
  assert.match(recovery, /Guardar resultado/);
  assert.match(recovery, /Confirmar resultado/);
  assert.match(recovery, /Concluir histórico/);
  assert.doesNotMatch(recovery, /A decisão não implica aprovação automática nem reabertura do ano/);
  assert.match(modal, /Guardar nota de 2025/);
});
