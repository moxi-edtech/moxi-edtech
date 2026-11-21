import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync(
  new URL("../../src/app/api/secretaria/turmas/[id]/alunos/lista/route.ts", import.meta.url), "utf8",
);
const service = readFileSync(
  new URL("../../src/lib/documentos/listaNominalService.ts", import.meta.url), "utf8",
);

test("legacy JSON roster uses the same paged canonical reader as PDF/XLSX", () => {
  assert.match(route, /loadNominalRoster\(/);
  assert.match(route, /jsonFields: true/);
  assert.match(route, /includeAllStatus,/);
  assert.match(route, /order,/);
  assert.match(route, /roster\.sortedMatriculas\.flatMap/);
  assert.match(route, /total: alunosOrdenados\.length/);
  assert.doesNotMatch(route, /defaultLimit: 50|matriculasQuery|\.limit\(50\)/);
  assert.match(route, /authorizeTurmasManage/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /canExportSensitiveRosterFields/);
  assert.match(route, /renderListaNominalPdfBuffer/);
  assert.match(route, /private, no-store/);
});

test("JSON projection avoids unnecessary avatar/PII and canonical reader iterates bounded pages", () => {
  assert.match(service, /jsonFields = false/);
  assert.match(service, /if \(jsonFields && pdfFields\)/);
  assert.match(service, /jsonFields \? optionalJsonFields : optionalPdfFields/);
  assert.match(service, /extendedStudentFields/);
  assert.match(service, /const pageSize = 500/);
  assert.match(service, /const maxRoster = 10000/);
  assert.match(service, /applyKf2ListInvariants/);
  assert.match(service, /\.eq\("escola_id", escolaId\)\.eq\("session_id", sessionId\)/);
  assert.match(service, /if \(offset === maxRoster && \(data\?\.length \?\? 0\)\)/);
});
