import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("AUT-004/005: pending RAA decisions remain server-side and grade entry stays in the selected student's workspace", () => {
  const panel = read("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const workspace = read("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(panel, /onLancarNota\(activeCase && isRaaTrimestre\(activeCase.periodo\)/);
  assert.match(panel, /await readJson\("\/api\/secretaria\/faltas\/justificacoes"/);
  assert.match(panel, /await readJson\("\/api\/academico\/raa\/reapreciacao\/decisao"/);
  assert.match(panel, /await readJson\("\/api\/academico\/raa\/indisciplina"/);
  assert.match(panel, /await readJson\("\/api\/academico\/exames\/resultados"/);
  assert.match(panel, /await refreshAfterSave\(\)/);
  assert.match(workspace, /originAnoLetivoId: source.ano_letivo_id/);
});

test("AUT-006/011: stale academic reads are aborted, unknown data is not treated as absence and appeals reuse retry keys", () => {
  const panel = read("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  assert.match(panel, /loadControllerRef\.current\?\.abort\(\)/);
  assert.match(panel, /signal: controller.signal/);
  assert.match(panel, /if \(controller.signal.aborted\) return/);
  assert.match(panel, /setIncompleteSources\(missing\)/);
  assert.match(panel, /reapreciacaoKeyRef\.current \?\?= crypto.randomUUID\(\)/);
  assert.match(panel, /reapreciacaoKeyRef\.current = null/);
});

test("AUT-007/009: PDF reads active enrollments and matches source grades by enrollment ID, never pupil ID", () => {
  const pauta = read("lib/pedagogico/pauta-geral.ts");
  assert.match(pauta, /ACTIVE_MATRICULA_STATUSES/);
  assert.match(pauta, /matriculaIdPorAluno\.set\(aluno.id, row.id\)/);
  assert.match(pauta, /matriculaIdPorAluno\.get\(alunoId\)/);
  assert.match(pauta, /const key = `\$\{matriculaId\}:\$\{disciplina.id\}:\$\{trimestre\}`/);
  assert.doesNotMatch(pauta, /const key = `\$\{alunoId\}:\$\{disciplina.id\}:\$\{trimestre\}`/);
});

test("AUT-010/011/012: transfer preflight uses grade evidence and admission capacity, with same RBAC as the mutation", () => {
  const preview = read("app/api/secretaria/matriculas/[matriculaId]/check-transfer/route.ts");
  const rectification = read("app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts");
  const writer = read("app/api/secretaria/matriculas/[matriculaId]/transfer/route.ts");
  const form = read("components/secretaria/TransferForm.tsx");
  const list = read("components/secretaria/MatriculasListClient.tsx");
  assert.match(preview, /requireRoleInSchool/);
  assert.match(preview, /resolveEscolaIdForUser/);
  // Preflight and the database guard share the exact same canonical evidence
  // predicate, including historical notes, official pautas and RAA decisions.
  assert.match(preview, /\.rpc\("turma_transfer_academic_evidence_v1"/);
  assert.match(preview, /typeof evidence\.data\?\.has_evidence !== "boolean"/);
  assert.match(preview, /allow: blockers.length === 0/);
  assert.match(preview, /TRANSFER_ACADEMIC_RECONCILIATION_REQUIRED/);
  assert.match(rectification, /requerConciliacaoAcademica/);
  assert.match(rectification, /if \(requerConciliacaoAcademica\) blockers.push/);
  assert.match(writer, /rpcError.code === "P1050"/);
  assert.match(form, /controller.signal.aborted/);
  assert.match(form, /onResolveAcademic/);
  assert.match(list, /action: "reenrollment"/);
  assert.match(list, /alunoId: selectedMatricula.aluno_id/);
});

test("AUT-005/010: paid destination and exceptional RAA states have contextual next steps, never another checkout", () => {
  const chrome = read("components/secretaria/RematriculaWorkspaceChrome.tsx");
  const actionable = chrome.slice(chrome.indexOf("const ACTIONABLE:"), chrome.indexOf("export function rematriculaDisplayState"));
  assert.doesNotMatch(actionable, /DOCUMENT_PENDING|ACADEMIC_HISTORY_PENDING/);
  for (const status of [
    "ACADEMIC_HISTORY_PENDING", "DOCUMENT_PENDING", "ACADEMIC_ATTENDANCE_REVIEW_REQUIRED",
    "ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED", "ACADEMIC_NOT_APPROVED",
    "DEBT_BLOCKED", "PRICE_NOT_CONFIGURED", "PENDING_ORDER_REVIEW",
    "LEGACY_REVIEW_REQUIRED", "TARGET_YEAR_NOT_CONFIGURED",
  ]) {
    assert.ok(chrome.includes('status === "' + status + '"'), status);
  }
  assert.match(chrome, /Boolean\(academicPlan\)/);
});

test("AUT-009: official general grade PDF reads every matching note, never the first PostgREST page", () => {
  const pauta = read("lib/pedagogico/pauta-geral.ts");
  assert.match(pauta, /avaliacoes!inner/);
  assert.match(pauta, /const pageSize = 500/);
  assert.match(pauta, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(pauta, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(pauta, /if \(\(notasRows\?\.length \?\? 0\) < pageSize\) break/);
  assert.match(pauta, /offset >= maxGradeRows/);
});
