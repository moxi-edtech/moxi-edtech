import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedClosureCriticalKeys,
  assertAuthorizedClosurePreflight,
  closureCriticalKey,
  FechamentoExecutionError,
  resolveVerifiedClosureExecution,
  type FechamentoJobSnapshot,
} from "../../src/lib/secretaria/fechamento-execution-contract";
import type {
  PendenciaFechamento,
  RelatorioSanidadeFechamento,
} from "../../src/app/api/secretaria/fechamento-academico/validacoes/types";

const school = "40000000-0000-0000-0000-000000000001";
const year = "40000000-0000-0000-0000-000000000002";
const term = "40000000-0000-0000-0000-000000000003";
const run = "40000000-0000-0000-0000-000000000004";
const user = "40000000-0000-0000-0000-000000000005";
const turma = "40000000-0000-0000-0000-000000000006";
const matricula = "40000000-0000-0000-0000-000000000007";

const saved: FechamentoJobSnapshot = {
  run_id: run,
  escola_id: school,
  executor_user_id: user,
  fechamento_tipo: "fechar_trimestre",
  estado: "PENDING_VALIDATION",
  ano_letivo_id: year,
  periodo_letivo_id: term,
  turma_ids: [turma],
  matricula_ids: [matricula],
  parametros: { motivo: "Fecho do trimestre", permitir_reaberto_override: true },
};
const request = {
  runId: run,
  escolaId: school,
  executorUserId: user,
  authenticatedUserId: user,
};
const finding = (
  overrides: Partial<PendenciaFechamento> = {},
): PendenciaFechamento => ({
  id: "id-gerado-a-cada-preflight",
  regra: "NOTAS_PENDENTES",
  severidade: "CRITICAL",
  turma_id: turma,
  matricula_id: matricula,
  aluno_id: user,
  mensagem: "Notas não lançadas",
  pode_excecao: true,
  ...overrides,
});
const report = (
  pendencias: PendenciaFechamento[] = [],
): RelatorioSanidadeFechamento => ({
  ok: pendencias.length === 0,
  acao: "fechar_trimestre",
  escola_id: school,
  ano_letivo_id: year,
  periodo_letivo_id: term,
  pendencias,
  summary: {
    total: pendencias.length,
    critical: pendencias.filter((p) => p.severidade === "CRITICAL").length,
    warn: 0,
    turmas_afetadas: pendencias.length ? 1 : 0,
    matriculas_afetadas: pendencias.length ? 1 : 0,
  },
});

test("Stored job, not event, supplies all academic parameters and arrays", () => {
  const resolved = resolveVerifiedClosureExecution(saved, request);
  assert.equal(resolved.anoLetivoId, year);
  assert.equal(resolved.periodoLetivoId, term);
  assert.deepEqual(resolved.turmaIds, [turma]);
  assert.deepEqual(resolved.matriculaIds, [matricula]);
  assert.equal(resolved.acao, "fechar_trimestre");
  assert.equal(resolved.motivo, "Fecho do trimestre");
  assert.equal(resolved.allowReabertoOverride, true);
});

test("Wrong school, executor, authenticated user or run id never executes", () => {
  const different = "40000000-0000-0000-0000-000000000008";
  for (const changed of [
    { ...request, escolaId: different },
    { ...request, executorUserId: different },
    { ...request, authenticatedUserId: different },
    { ...request, runId: different },
  ]) {
    assert.throws(() => resolveVerifiedClosureExecution(saved, changed),
      FechamentoExecutionError);
  }
});

test("Pending-only job forbids duplicate dispatch and completed/failed replay", () => {
  for (const estado of [
    "CLOSING_PERIOD", "FINALIZING_ENROLLMENTS", "DONE", "FAILED",
  ]) {
    assert.throws(() => resolveVerifiedClosureExecution({ ...saved, estado }, request),
      FechamentoExecutionError);
  }
});

test("Trimestre requires a persisted period, annual close must not take one", () => {
  for (const job of [
    { ...saved, periodo_letivo_id: null },
    { ...saved, fechamento_tipo: "fechar_ano" },
    { ...saved, fechamento_tipo: "unknown", periodo_letivo_id: null },
  ]) {
    assert.throws(() => resolveVerifiedClosureExecution(job, request),
      FechamentoExecutionError);
  }
  const annual = resolveVerifiedClosureExecution({
    ...saved, fechamento_tipo: "fechar_ano", periodo_letivo_id: null,
  }, request);
  assert.equal(annual.acao, "fechar_ano");
  assert.equal(annual.periodoLetivoId, undefined);
});

test("Only explicitly approved, exception-eligible critical findings survive", () => {
  const issue = finding();
  const review = report([issue]);
  const allowed = approvedClosureCriticalKeys(review, [issue.id]);
  assert.deepEqual(allowed, [closureCriticalKey(issue)]);
  assert.doesNotThrow(() => assertAuthorizedClosurePreflight(
    report([{ ...issue, id: "new-id-from-new-preflight" }]), allowed,
  ));
  assert.throws(() => approvedClosureCriticalKeys(review, []), FechamentoExecutionError);
  assert.throws(() => approvedClosureCriticalKeys(
    report([{ ...issue, pode_excecao: false }]), [issue.id],
  ), FechamentoExecutionError);
});

test("New criticals, a changed matrícula and legal snapshot blockers fail closed", () => {
  const issue = finding();
  const allowed = approvedClosureCriticalKeys(report([issue]), [issue.id]);
  for (const pendencias of [
    [issue, finding({ matricula_id: "another-matricula" })],
    [finding({ regra: "SNAPSHOT_LEGAL_CONFLITO", pode_excecao: false })],
    [finding({ matricula_id: "new-matricula" })],
  ]) {
    assert.throws(() => assertAuthorizedClosurePreflight(report(pendencias), allowed),
      FechamentoExecutionError);
  }
  assert.doesNotThrow(() => assertAuthorizedClosurePreflight(report(), []));
});

test("Malformed stored exceptions must never authorize the worker", () => {
  for (const approved_critical_keys of ["anything", [null], [123]]) {
    assert.throws(() => resolveVerifiedClosureExecution({
      ...saved,
      parametros: { approved_critical_keys },
    }, request), FechamentoExecutionError);
  }
});
