import test from "node:test";
import assert from "node:assert/strict";
import { currentGradePeriod, gradePeriodState, schoolCalendarDate, type GradePeriodRow } from "../../src/lib/academico/grade-period-context";

const rows: GradePeriodRow[] = [
  { id: "p1", numero: 1, data_inicio: "2026-09-01", data_fim: "2026-12-18", trava_notas_em: null },
  { id: "p2", numero: 2, data_inicio: "2027-01-04", data_fim: "2027-04-09", trava_notas_em: null },
  { id: "p3", numero: 3, data_inicio: "2027-04-26", data_fim: "2027-06-18", trava_notas_em: null },
];

test("The current trimester comes from the actual 2026/27 academic calendar", () => {
  assert.equal(currentGradePeriod(rows, new Date("2026-10-29T20:00:00Z")), 1);
  assert.equal(currentGradePeriod(rows, new Date("2027-02-04T12:00:00Z")), 2);
  assert.equal(currentGradePeriod(rows, new Date("2027-05-15T12:00:00Z")), 3);
  assert.equal(currentGradePeriod(rows, new Date("2026-12-25T12:00:00Z")), null);
});

test("Luanda local dates, not UTC server dates, determine the current period", () => {
  assert.equal(schoolCalendarDate(new Date("2027-01-03T23:30:00Z")), "2027-01-04");
  assert.equal(currentGradePeriod(rows, new Date("2027-01-03T23:30:00Z")), 2);
});

test("Future, past, locked and unconfigured periods are never silently auto-selected", () => {
  assert.equal(gradePeriodState(rows[1], new Date("2026-10-29T12:00:00Z")), "future");
  assert.equal(gradePeriodState(rows[0], new Date("2027-01-10T12:00:00Z")), "past");
  assert.equal(gradePeriodState({ ...rows[0], trava_notas_em: "2026-10-29T10:00:00Z" }, new Date("2026-10-29T12:00:00Z")), "locked");
  assert.equal(gradePeriodState({ ...rows[0], data_inicio: null }), "unconfigured");
  assert.equal(currentGradePeriod([rows[0], { ...rows[0], id: "overlap", numero: 2 }], new Date("2026-10-29T12:00:00Z")), null);
});
