import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  MAX_TURMAS_POR_LOTE,
  MAX_LOTES_NOMINAIS_POR_HORA,
  uniqueTurmaIds,
  progressoLote,
  parcialLote,
  statusFinalLote,
} from "../../src/lib/documentos/rosterBatchPolicy";
import { safeCsvCell, serializeRosterCsv } from "../../src/lib/command-center/roster-export-policy";

// Identificadores e conteúdo exclusivamente sintéticos.
test("limites explícitos e rejeição de duplicados", () => {
  assert.equal(MAX_TURMAS_POR_LOTE, 10);
  assert.equal(MAX_LOTES_NOMINAIS_POR_HORA, 10);
  assert.equal(uniqueTurmaIds(["T-A", "T-B"]), true);
  assert.equal(uniqueTurmaIds(["T-A", "T-A"]), false);
});

test("lote parcialmente concluído permite ZIP sem esconder a falha", () => {
  const result = progressoLote([
    { turma_id: "T-A", status: "SUCCESS" },
    { turma_id: "T-B", status: "FAILED" },
    { turma_id: "T-C", status: "QUEUED" },
  ]);
  assert.deepEqual(result, { processed: 2, successCount: 1, failedCount: 1 });
  assert.equal(statusFinalLote(1), "SUCCESS");
  assert.equal(parcialLote(1, 1), true);
  assert.equal(statusFinalLote(0), "FAILED");
  assert.equal(parcialLote(0, 3), false);
});

test("células perigosas de CSV ficam neutralizadas, incluindo espaços e controlos", () => {
  for (const input of ["=1+1", "+SUM(A1:A3)", "-1+1", "@function", "\t=NOW()", "\r\n=1"]) {
    assert.match(safeCsvCell(input), /^"'/, input);
  }
  const csv = serializeRosterCsv([
    { nome: "=HYPERLINK(\"evil\")", numero: "P-0001", turma: "9ª A", situacaoMatricula: "Concluída" },
    { nome: "Álvaro Simulado", numero: "P-0002", turma: "9ª A" },
  ], "user-test", "2026-11-16T12:00:00Z");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Concluída"/);
  assert.match(csv, /"'=HYPERLINK\(""evil""\)"/);
  assert.match(csv, /"Álvaro Simulado"/);
});

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("worker valida job, escola e selecção antes de usar service_role", () => {
  const worker = source("inngest/functions/pautas-lote.ts");
  assert.match(worker, /currentJob\.escola_id !== escola_id/);
  assert.match(worker, /turma_ids\.some\(id => !permitted\.has\(id\)\)/);
  assert.match(worker, /\.eq\("escola_id", escola_id\)\.in\("id", turma_ids\)/);
  assert.match(worker, /statusFinalLote\(successItems\.length\)/);
  assert.match(worker, /pautas_lote_itens"\)\s*\.select\("turma_id,status,pdf_path,checksum_sha256"\)/);
});

test("auditoria por turma só contém metadados e é exigida antes do ZIP", () => {
  const worker = source("inngest/functions/pautas-lote.ts");
  assert.match(worker, /acao: "LISTA_NOMINAL_LOTE_EXPORTADA"/);
  assert.match(worker, /nominalRows/);
  assert.match(worker, /if \(auditError\)/);
  assert.ok(worker.indexOf("if (auditError)") < worker.indexOf('const archive = archiver("zip"'));
  assert.doesNotMatch(worker, /details:\s*\{[^}]*aluno_nome/);
});

test("frontend reconhece cada turma e usa endpoint canónico sem bypass", () => {
  const hub = source("components/secretaria/QuickDocHub.tsx");
  const turmas = source("components/secretaria/TurmasListClient.tsx");
  const endpoint = source("app/api/secretaria/documentos-oficiais/lote/route.ts");
  const legacy = source("app/api/escola/[id]/admin/turmas/bulk-print/route.ts");
  assert.match(hub, /Resultado por turma/);
  assert.match(hub, /\}, 15000\)/);
  assert.match(turmas, /\/api\/secretaria\/documentos-oficiais\/lote/);
  assert.match(turmas, /const years = Array\.from\(new Set/);
  assert.match(endpoint, /MAX_TURMAS_POR_LOTE/);
  assert.match(legacy, /if \(!userEscolaId\)/);
  assert.doesNotMatch(legacy, /userEscolaId \?\? requestedEscolaId/);
});
