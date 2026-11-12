import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("academic situation uses the existing reenrollment route, preserving student context", () => {
  const registry = source("lib/balcao/action-registry.ts");
  assert.match(registry, /reenrollment: \{/);
  assert.match(registry, /label: "Situação académica"/);
  assert.match(registry, /balcaoView: "reenrollment"/);
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /id: "reenrollment",\s*title: "Situação académica"/);
  assert.match(workspace, /aria-label="Aluno selecionado para situação académica"/);
});

test("individual grade action is not dependent on RAA pending cases and respects permission", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  // A verified academic blocker must stay actionable after settlement.
  assert.match(workspace, /view === "reenrollment" && showAcademicResolution && rematriculaCanWriteGrades/);
  assert.match(workspace, /const showAcademicResolution = !paidExistingDestination \|\| Boolean\(academicBlocker\)/);
  assert.match(workspace, /showAcademicResolution && raaMatriculaId && raaAlunoId/);
  assert.match(workspace, /rematriculaAcademic\?\.source\?\.turma_id/);
  assert.match(workspace, /rematriculaAcademic\?\.source\?\.ano_letivo_id/);
  assert.match(workspace, /onLancarNota\(null, rematriculaAcademic\?\.disciplina_ids_pendentes\?\.\[0\] \?\? null\)/);
  assert.match(workspace, /if \(!rematricula.canWriteGrades\) return/);
});

test("grade modal selects official assessment type and submits exactly one student", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /tipoAvaliacao.*"MAC".*"NPP".*"NPT"/);
  for (const kind of ["MAC", "NPP", "NPT"]) assert.match(modal, new RegExp('<option value="' + kind + '">'));
  assert.match(modal, /tipo_avaliacao: tipoAvaliacao/);
  assert.match(modal, /notas: \[\{ aluno_id: alunoId, valor \}\]/);
  assert.match(modal, /originAnoLetivoId/);
  assert.match(modal, /\/api\/secretaria\/notas\/periodos/);
  assert.match(modal, /\/pauta-grid\?/);
});

test("canonical grade API enforces tenant, role, official calendar and enrollment", () => {
  const route = source("app/api/secretaria/notas/route.ts");
  assert.match(route, /authorizeTurmasManage/);
  assert.match(route, /resolveAcademicYearContext/);
  assert.match(route, /GRADE_PERIOD_UNRESOLVED/);
  assert.match(route, /GRADE_DISCIPLINE_INACTIVE_TRIMESTER/);
  assert.match(route, /ACTIVE_ENROLLMENT_REQUIRED/);
  assert.match(route, /lancar_notas_batch/);
  assert.match(route, /idempotency-key/);
});
 
test("academic situation prioritizes the current state and next action before trimester progress", () => {
  const header = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  assert.match(header, /Situação académica<\/h2>/);
  assert.match(header, /aria-label="Resumo da situação académica"/);
  const nextAction = header.indexOf('aria-label="Próxima ação académica"');
  const calendar = header.indexOf('aria-label="Calendário de origem"');
  assert.ok(nextAction >= 0 && calendar > nextAction,
    "the single next action must precede the optional calendar",
  );
});

test("no prior-year enrollment does not hide current-year actions or create an artificial origin block", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  const lifecycle = source("components/secretaria/BalcaoSituacaoAcademica.tsx");
  assert.match(workspace, /<Catalogo/);
  assert.doesNotMatch(workspace, /view !== "reenrollment" \|\| Boolean\(dossier\.aluno\.matricula_id\)/);
  assert.doesNotMatch(workspace, /!dossier\.aluno\.matricula_id \? "SOURCE_RECORD_REQUIRED"/);
  assert.match(lifecycle, /resolveStudentYearSituation/);
  assert.match(workspace, /!situacaoAcademica\.data\.current &&\s*!situacaoAcademica\.data\.previous/);
  assert.match(workspace, /onNavigateAction\("enrollment"\)/);
  const api = source("app/api/secretaria/notas/route.ts");
  assert.match(api, /ACTIVE_ENROLLMENT_REQUIRED/);
});

test("grade receipt confirms exactly what was saved and requires deliberate next action", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /setGradeReceipt\(\{/);
  assert.match(modal, /disciplina: selected\.disciplina\.nome/);
  assert.match(modal, /onAcademicSaved\?\.\(\)/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.match(modal, /Nota registada/);
  assert.match(modal, /Lançar outra avaliação/);
  assert.match(modal, /disabled=\{loading \|\| periodUnavailable \|\| Boolean\(gradeReceipt\)\}/);
});

test("locked periods are explained, and official write permissions remain server controlled", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /selectedPeriod\?\.estado === "past"/);
  assert.match(modal, /selectedPeriod\?\.estado === "locked"/);
  assert.match(modal, /Guardar com autorização/);
  assert.match(modal, /periodReadOnly/);
  assert.match(modal, /disciplina_ativa/);
  const api = source("app/api/secretaria/notas/route.ts");
  assert.match(api, /authorizeTurmasManage/);
  assert.match(api, /lancar_notas_batch/);
  assert.match(api, /Past\/locked writes are adjudicated by the database trigger/);
});

test("existing target enrollment requires payment reconciliation, not duplicate enrollment", () => {
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const writer = source("app/api/secretaria/balcao/rematriculas/route.ts");
  const chrome = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  const balc = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.ok(status.includes('status = "RECONFIRMATION_REQUIRED"'));
  assert.ok(status.includes('matriculaDestino?.turma_id && !reclassificacao'));
  assert.ok(status.indexOf('!service || !service.ativo') <
    status.indexOf('} else if (matriculaDestino?.turma_id && !reclassificacao)'),
    "a missing service must not expose a payment CTA that cannot open");
  assert.ok(writer.includes('REMATRICULA_TARGET_ALREADY_ENROLLED'));
  assert.ok(writer.includes('reconfirmacaoApenas'));
  assert.ok(chrome.includes('title: "Taxa por confirmar"'));
  assert.ok(chrome.includes('Regularizar taxa de rematrícula'));
  assert.ok(balc.includes('taxaValor={rematriculaPrice}'));
});

test("paid order without verified destination must stay in reconciliation", () => {
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const writer = source("app/api/secretaria/balcao/rematriculas/route.ts");
  assert.ok(status.includes('pedidoDestinoId && matriculaDestino?.id'));
  assert.ok(status.includes('String(pedidoDestinoId) === String(matriculaDestino.id)'));
  assert.ok(status.includes('pagamentoSemProgressao = pedidoExistente?.status === "granted" && !pedidoTemMatriculaDestino'));
  assert.ok(status.includes('pedidoConcluido = pedidoExistente?.status === "granted" && pedidoTemMatriculaDestino'));
  assert.ok(writer.includes('!matriculaDestinoId || !matriculaDestino?.id'));
  assert.ok(writer.includes('code: "REMATRICULA_RECONCILIATION_REQUIRED"'));
});

test("payment read failures and concurrent active orders never start another checkout", () => {
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const writer = source("app/api/secretaria/balcao/rematriculas/route.ts");
  const hook = source("hooks/useRematriculaBalcao.ts");
  assert.ok(status.includes('if (pedidosAtivosError) throw pedidosAtivosError'));
  assert.ok(status.includes('if (intentsError || pagamentosError) throw intentsError ?? pagamentosError'));
  assert.ok(writer.includes('if (pedidosExistentesError) throw pedidosExistentesError'));
  assert.ok(writer.includes('if (intentsError || pagamentosError) throw intentsError ?? pagamentosError'));
  assert.ok(writer.includes('pedidoError?.code === "23505"'));
  assert.ok(hook.includes('const clearStatusSnapshot = useCallback'));
  assert.ok(hook.includes('clearStatusSnapshot();'));
});
