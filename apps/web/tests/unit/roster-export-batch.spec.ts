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
  makeNominalBatchKey,
  readNominalBatchKey,
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
  assert.match(endpoint, /parsed\.data\.order \?\? "nome_asc"/);
  assert.match(legacy, /if \(!userEscolaId\)/);
  assert.doesNotMatch(legacy, /userEscolaId \?\? requestedEscolaId/);
});

test("chave versionada preserva modo e exclusões no reprocessamento", () => {
  const actorId = "00000000-0000-4000-8000-000000000001";
  const academicYearId = "00000000-0000-4000-8000-000000000002";
  const key = makeNominalBatchKey({
    actorId, academicYearId, mode: "ano_letivo", month: "03",
    isAlbum: false, includeAllStatus: true,
  }, ["00000000-0000-4000-8000-000000000003"]);
  assert.deepEqual(readNominalBatchKey(key), {
    actorId, academicYearId, mode: "ano_letivo", order: "nome_asc",
    month: "03", isAlbum: false, includeAllStatus: true,
  });
  assert.equal(readNominalBatchKey("legacy:uncertain"), null);
  assert.equal(readNominalBatchKey(key.replace(":03:", ":13:")), null);
});

test("esta PR não expõe uma rota CSV de listas nominais", () => {
  assert.throws(
    () => source("app/api/secretaria/turmas/[id]/alunos/csv/route.ts"),
    /ENOENT/,
  );
});

test("reprocessamento bloqueia modo original irrecuperável", () => {
  const retry = source("app/api/secretaria/documentos-oficiais/lote/reprocess/route.ts");
  assert.match(retry, /readNominalBatchKey/);
  assert.match(retry, /prefs\.actorId !== job\.created_by/);
  assert.match(retry, /include_all_status: prefs\.includeAllStatus/);
  assert.match(retry, /canExportSensitiveRosterFields/);
});

test("reprocessamento restaura nomes das turmas concluídas antes de refazer ZIP", () => {
  const worker = source("inngest/functions/pautas-lote.ts");
  assert.match(worker, /const missingTurmaIds = successItems/);
  assert.match(worker, /\.filter\(turmaId => !turmaMap\.has\(turmaId\)\)/);
  assert.match(worker, /\.eq\("escola_id", escola_id\)\s*\.in\("id", missingTurmaIds\)/);
  assert.match(worker, /previousTurmas\?\.length !== missingTurmaIds\.length/);
  assert.ok(worker.indexOf("const missingTurmaIds") < worker.indexOf("for (const [index, item] of successItems.entries())"));
});

test("lote conserva ordem Z–A ao reprocessar e aceita chaves v2 já existentes", () => {
  const actorId = "00000000-0000-4000-8000-000000000001";
  const academicYearId = "00000000-0000-4000-8000-000000000002";
  const turmaId = "00000000-0000-4000-8000-000000000003";
  const key = makeNominalBatchKey({
    actorId, academicYearId, mode: "operacional", order: "nome_desc",
    month: undefined, isAlbum: false, includeAllStatus: false,
  }, [turmaId]);
  assert.equal(readNominalBatchKey(key)?.order, "nome_desc");
  assert.equal(readNominalBatchKey(key.replace(":nome_desc:", ":unknown:")), null);
  const previous = ["roster", "v2", actorId, academicYearId, "operacional", "none", "standard", "padrao", turmaId].join(":");
  assert.equal(readNominalBatchKey(previous)?.order, "chamada");
});

test("ambas as rotas de lote enviam a ordem ao worker e permitem reprocessar", () => {
  const canonical = source("app/api/secretaria/documentos-oficiais/lote/route.ts");
  const legacy = source("app/api/escola/[id]/admin/turmas/bulk-print/route.ts");
  const list = source("components/secretaria/TurmasListClient.tsx");
  const worker = source("inngest/functions/pautas-lote.ts");
  const retry = source("app/api/secretaria/documentos-oficiais/lote/reprocess/route.ts");
  const download = source("app/api/secretaria/documentos-oficiais/lote/[id]/download/route.ts");
  for (const endpoint of [canonical, legacy]) {
    assert.match(endpoint, /makeNominalBatchKey/);
    assert.match(endpoint, /order:/);
  }
  assert.match(legacy, /order: z\.enum\(\["nome_asc", "nome_desc"\]\)/);
  assert.match(legacy, /const order = parsed\.data\.order \?\? "nome_asc"/);
  assert.match(legacy, /mode: undefined,\s+order,/);
  assert.match(list, /order: nominalOrder/);
  assert.match(list, /Ordem dos alunos na impressão em lote/);
  assert.match(worker, /order: event\.data\.order/);
  assert.match(retry, /order: prefs\.order/);
  assert.match(download, /readNominalBatchKey/);
  assert.match(download, /download: `Listas de Turmas - \$\{nominalOrderLabel\}\.zip`/);
  assert.match(download, /createSignedUrl\(job\.zip_path, expiresInSec, downloadOptions\)/);
});
