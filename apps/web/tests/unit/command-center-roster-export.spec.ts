import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ROSTER_EXPORT_POLICY,
  resolveRosterExportPolicy,
  rosterExportAudit,
  safeCsvCell,
  serializeRosterCsv,
} from "../../src/lib/command-center/roster-export-policy";

const schoolA = "00000000-0000-4000-8000-000000000001";
const schoolB = "00000000-0000-4000-8000-000000000002";

test("Exportação negada por padrão e isolada por escola", () => {
  assert.equal(DEFAULT_ROSTER_EXPORT_POLICY.enabled, false);
  assert.deepEqual(resolveRosterExportPolicy(schoolA, undefined), DEFAULT_ROSTER_EXPORT_POLICY);
  const configuration = JSON.stringify({ [schoolA]: {
    enabled: true, maxRows: 50, roles: ["secretaria"], purposeCode: "secretaria_atendimento", retentionDays: 30,
  } });
  assert.equal(resolveRosterExportPolicy(schoolA, configuration).enabled, true);
  assert.deepEqual(resolveRosterExportPolicy(schoolB, configuration), DEFAULT_ROSTER_EXPORT_POLICY);
  assert.deepEqual(resolveRosterExportPolicy(schoolA, "{broken"), DEFAULT_ROSTER_EXPORT_POLICY);
  assert.deepEqual(resolveRosterExportPolicy(schoolA, JSON.stringify({
    [schoolA]: { enabled: true, maxRows: 9999, roles: ["secretaria"] },
  })), DEFAULT_ROSTER_EXPORT_POLICY);
});

test("CSV neutraliza fórmulas incluindo prefixo com espaços, aspas e CRLF", () => {
  for (const text of ["=1+2", "+SHELL", "-7", "@cmd", "  =SUM(1,2)", "\t+FORMULA"]) {
    assert.ok(safeCsvCell(text).startsWith("\"'"), text);
  }
  assert.equal(safeCsvCell('A"B'), '"A""B"');
  const csv = serializeRosterCsv(
    [{ nome: "=1+2", numero: null, turma: "A" }], "user-fixture", "2026-10-22T12:00:00Z",
  );
  assert.match(csv, /'\=1\+2/);
  assert.match(csv, /Emitido por/);
  assert.doesNotMatch(csv, /telefone|morada|bi_numero|encarregado/i);
});

test("Auditoria guarda apenas filtros booleanos e contagens, nunca conteúdo", () => {
  const audit = rosterExportAudit({
    userId: "user-fixture", escolaId: schoolA, type: "turma",
    entityId: "turma-fixture", count: 55, hasSearch: true,
    exportedAt: "2026-10-22T12:00:00Z",
  });
  assert.equal(audit.row_count, 55);
  assert.equal(audit.search_applied, true);
  assert.doesNotMatch(JSON.stringify(audit), /nome|numero_processo|contacto|valor/);
});
