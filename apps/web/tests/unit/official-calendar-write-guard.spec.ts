import test from "node:test";
import assert from "node:assert/strict";
import {
  validateOfficialCalendarAdjustment,
  type OfficialCalendarTemplate,
  type OfficialCalendarPeriod,
  type RequestedPeriodAdjustment,
} from "../../src/lib/academico/official-calendar-write-guard";

const template: OfficialCalendarTemplate = {
  id: "med-regular-2026", ano_base: 2026, is_oficial: true,
  estado: "PUBLICADO", versao_documento: "FINAL-ACTUALIZADO",
  data_inicio: "2026-09-01", data_fim: "2027-08-31",
  items: [
    { id: "med-p1", numero: 1, tipo: "PERIODO_LETIVO", data_inicio: "2026-09-01", data_fim: "2026-12-18", peso: 30 },
    { id: "med-p2", numero: 2, tipo: "PERIODO_LETIVO", data_inicio: "2027-01-04", data_fim: "2027-04-09", peso: 30 },
    { id: "med-p3", numero: 3, tipo: "PERIODO_LETIVO", data_inicio: "2027-04-26", data_fim: "2027-06-18", peso: 40 },
  ],
};
const yearId = "current-year";
const originals: OfficialCalendarPeriod[] = template.items.map((item) => ({
  id: `p-${item.numero}`, numero: item.numero!, tipo: "TRIMESTRE",
  data_inicio: item.data_inicio, data_fim: item.data_fim, peso: item.peso,
  trava_notas_em: item.numero === 1 ? "2026-12-20T16:00:00Z" : null,
  source_template_id: template.id, source_item_id: item.id,
  source_version: template.versao_documento, offering_id: null,
}));
const requests: RequestedPeriodAdjustment[] = originals.map((item) => ({
  ano_letivo_id: yearId, tipo: item.tipo, numero: item.numero,
  data_inicio: item.data_inicio, data_fim: item.data_fim,
  peso: item.peso, id: item.id,
}));
const input = {
  academicYear: 2026, academicYearId: yearId,
  requestedYearStart: template.data_inicio, requestedYearEnd: template.data_fim,
  currentYearStart: template.data_inicio, currentYearEnd: template.data_fim,
  existing: originals, requested: requests, template,
};

test("Preserves official template identity and the existing grade deadlines", () => {
  const result = validateOfficialCalendarAdjustment(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.lockChanged, false);
  assert.equal(result.periods.length, 3);
  assert.deepEqual(result.periods.map((item) => item.source_item_id), ["med-p1", "med-p2", "med-p3"]);
  assert.equal(result.periods[0].trava_notas_em, "2026-12-20T16:00:00Z");
});

test("Rejects dates that differ from published MED 2026/2027 template", () => {
  const result = validateOfficialCalendarAdjustment({
    ...input, requested: [{ ...requests[0], data_fim: "2026-12-19" }, ...requests.slice(1)],
  });
  assert.deepEqual(result, { ok: false, code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION" });
});

test("Rejects wrong year dates, stale source references and a second trimester list", () => {
  for (const overrides of [
    { requestedYearStart: "2026-08-01" },
    { existing: originals.map((p, index) => index === 0 ? { ...p, source_template_id: null } : p) },
    { existing: originals.map((p, index) => index === 0 ? { ...p, source_item_id: "wrong" } : p) },
    { requested: [...requests.slice(0, 2), requests[1]] },
    { requested: [{ ...requests[0], peso: 99 }, ...requests.slice(1)] },
    { template: { ...template, estado: "RASCUNHO" } },
  ]) {
    const result = validateOfficialCalendarAdjustment({ ...input, ...overrides });
    assert.deepEqual(result, { ok: false, code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION" });
  }
});

test("Changing a notes deadline requires an explicit reason and preserves the decree", () => {
  const change: RequestedPeriodAdjustment[] = [
    { ...requests[0], trava_notas_em: "2026-12-21T16:00:00Z" },
    ...requests.slice(1),
  ];
  assert.deepEqual(validateOfficialCalendarAdjustment({ ...input, requested: change }), {
    ok: false, code: "CALENDAR_LOCK_CHANGE_REASON_REQUIRED",
  });
  const result = validateOfficialCalendarAdjustment({ ...input, requested: change, motivo: "Aprovação pedagógica" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lockChanged, true);
    assert.equal(result.periods[0].source_template_id, template.id);
    assert.equal(result.periods[0].trava_notas_em, "2026-12-21T16:00:00Z");
  }
});

test("Missing a published template or introducing offering-specific periods fails closed", () => {
  assert.deepEqual(validateOfficialCalendarAdjustment({ ...input, template: null }), {
    ok: false, code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION",
  });
  assert.deepEqual(validateOfficialCalendarAdjustment({
    ...input, existing: [{ ...originals[0], offering_id: "other-offering" }, ...originals.slice(1)],
  }), { ok: false, code: "OFFICIAL_CALENDAR_CHANGE_REQUIRES_RECONCILIATION" });
});
