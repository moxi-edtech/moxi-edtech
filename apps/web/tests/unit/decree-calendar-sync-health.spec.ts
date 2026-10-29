import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditDecreeSync, type DecreeSyncSnapshot } from "../../src/lib/academic-calendar/decree-sync-health";

function fixture(): DecreeSyncSnapshot {
  const templateId = "model-regular-2026";
  const yearId = "year-2026";
  const officialItems = [
    { id: "trimestre-1", nome: "I Trimestre", tipo: "PERIODO_LETIVO", numero: 1, data_inicio: "2026-09-01", data_fim: "2026-12-18" },
    { id: "trimestre-2", nome: "II Trimestre", tipo: "PERIODO_LETIVO", numero: 2, data_inicio: "2027-01-04", data_fim: "2027-04-09" },
    { id: "trimestre-3", nome: "III Trimestre", tipo: "PERIODO_LETIVO", numero: 3, data_inicio: "2027-04-26", data_fim: "2027-06-18" },
    { id: "prova-1", nome: "Provas do I Trimestre", tipo: "PROVA_TRIMESTRAL", data_inicio: "2026-12-09", data_fim: "2026-12-18" },
  ];
  return {
    year: { id: yearId, ano: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31" },
    offerings: [{ id: "offer-primary", education_subsystem: "REGULAR_ADULTOS", calendar_profile_id: templateId }],
    templates: [{
      id: templateId, ano_base: 2026, subsistema: "REGULAR_ADULTOS", estado: "PUBLICADO", is_oficial: true,
      data_inicio: "2026-09-01", data_fim: "2027-08-31",
      versao_documento: "FINAL-ACTUALIZADO",
      fonte_referencia: "Decreto do Ministério da Educação", fonte_documento_url: "https://example.org/official",
      items: officialItems,
    }],
    periods: officialItems.filter((item) => item.tipo === "PERIODO_LETIVO").map((item) => ({
      id: item.id, numero: item.numero!, tipo: "TRIMESTRE", data_inicio: item.data_inicio, data_fim: item.data_fim,
      offering_id: null, source_template_id: templateId, source_item_id: item.id, source_version: "FINAL-ACTUALIZADO",
    })),
    events: [{
      id: "evt-prova", nome: "Provas do I Trimestre", tipo: "PROVA_TRIMESTRAL",
      data_inicio: "2026-12-09", data_fim: "2026-12-18",
      offering_id: null, source_template_id: templateId, source_item_id: "prova-1", source_version: "FINAL-ACTUALIZADO",
    }],
  };
}

test("2026/2027 fully inherited from published decree is healthy", () => {
  const result = auditDecreeSync(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.expected_event_count, 1);
  assert.equal(result.expected_trimesters, 3);
});

test("school 2026/2027 with an August start, divergent trimesters and absent exams is blocked", () => {
  const data = fixture();
  data.year!.data_inicio = "2026-08-01";
  data.year!.data_fim = "2027-07-31";
  data.periods[0].data_inicio = "2026-08-01";
  data.events = [];
  const result = auditDecreeSync(data);
  assert.equal(result.ok, false);
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes("YEAR_RANGE_MISMATCH"));
  assert.ok(codes.includes("TRIMESTER_DATES_MISMATCH"));
  assert.ok(codes.includes("EXAM_EVENT_MISSING"));
});

test("period lineage missing is separately reported, without claiming dates have changed", () => {
  const data = fixture();
  data.periods.forEach((period) => {
    period.source_item_id = null;
    period.source_template_id = null;
    period.source_version = null;
  });
  const result = auditDecreeSync(data);
  assert.equal(result.ok, true);
  assert.ok(result.issues.some((issue) => issue.code === "TRIMESTER_SOURCE_MISSING" && issue.severity === "warning"));
  assert.ok(!result.issues.some((issue) => issue.code === "TRIMESTER_DATES_MISMATCH"));
});

test("mismatched, unofficial and cross-subsystem templates cannot be considered synchronized", () => {
  const data = fixture();
  data.templates[0].subsistema = "TECNICO_PROFISSIONAL";
  assert.equal(auditDecreeSync(data).ok, false);
  data.templates[0].subsistema = "REGULAR_ADULTOS";
  data.templates[0].is_oficial = false;
  assert.equal(auditDecreeSync(data).ok, false);
  data.templates[0].is_oficial = true;
  data.templates[0].estado = "RASCUNHO";
  assert.equal(auditDecreeSync(data).ok, false);
});

test("health endpoint has auth, school authorization and is read-only", () => {
  const source = readFileSync("src/app/api/secretaria/operacoes-academicas/calendario/decreto-health/route.ts", "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /resolveEscolaIdForUser/);
  assert.match(source, /requireRoleInSchool/);
  assert.match(source, /auditDecreeSync/);
  assert.doesNotMatch(source, /\.(insert|upsert|update|delete|rpc)\(/);
});

test("official year preparation persists template/item/version, and refuses editing active sessions", () => {
  const route = readFileSync("src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts", "utf8");
  assert.match(route, /source_template_id: periodTemplate\.id/);
  assert.match(route, /source_item_id: item\.id/);
  assert.match(route, /source_version: periodTemplate\.versao_documento/);
  assert.match(route, /CALENDAR_PROVENANCE_NOT_PERSISTED/);
  assert.match(route, /ACTIVE_YEAR_RECONCILIATION_REQUIRED/);
  assert.match(route, /CALENDAR_PROFILES_CONFLICT/);
});

test("legacy template application cannot overwrite active multi-offering schools silently", () => {
  const route = readFileSync("src/app/api/escola/[id]/admin/calendario/aplicar-template/route.ts", "utf8");
  assert.match(route, /CALENDAR_MULTI_OFFERING_REQUIRED/);
  assert.match(route, /ACTIVE_YEAR_RECONCILIATION_REQUIRED/);
  assert.match(route, /\.eq\('is_oficial', true\)/);
  assert.match(route, /\.eq\('estado', 'PUBLICADO'\)/);
  assert.match(route, /source_item_id: i\.id/);
});

test("calendar provenance RPC accepts legacy 2025 only in the absence of period items", () => {
  const sql = readFileSync("../../supabase/migrations/20261029181554_preserve_legacy_2025_calendar_provenance_compatibility.sql", "utf8");
  assert.match(sql, /t\.ano_base < 2026/);
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /i\.tipo::text = 'PERIODO_LETIVO'/);
  assert.match(sql, /v_has_permission/);
  assert.match(sql, /current_tenant_escola_id/);
});
