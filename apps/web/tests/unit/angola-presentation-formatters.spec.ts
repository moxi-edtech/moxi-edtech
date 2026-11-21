import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDate,
  formatDateTime,
  formatKwanza,
  monthName,
  SCHOOL_LOCALE,
  SCHOOL_TIME_ZONE,
} from "../../src/lib/formatters";
import { formatAnoLetivoDisplay } from "../../src/utils/formatters";

test("school calendar date never shifts with the viewer's time zone", () => {
  assert.equal(SCHOOL_LOCALE, "pt-AO");
  assert.equal(SCHOOL_TIME_ZONE, "Africa/Luanda");
  assert.equal(formatDate("2026-09-01"), formatDate("2026-09-01T00:00:00Z"));
  assert.equal(formatDate("2026-11-21T23:30:00Z"), formatDate("2026-11-22"));
  assert.equal(formatDate("2026-02-30"), "—");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid"), "—");
});

test("instants and wall-clock datetimes are presented in Luanda time", () => {
  assert.match(formatDateTime("2026-11-21T23:30:00Z"), /00:30/);
  assert.match(formatDateTime("2026-11-22T00:30:00"), /00:30/);
  assert.equal(formatDateTime("2026-11-22"), formatDate("2026-11-22"));
  assert.equal(formatDateTime("invalid"), "—");
});

test("Kwanza amounts, invalid values and month names use shared formatters", () => {
  assert.notEqual(formatKwanza(0), "—");
  assert.equal(formatKwanza(null), "—");
  assert.equal(formatKwanza(Number.NaN), "—");
  assert.equal(formatKwanza(Number.POSITIVE_INFINITY), "—");
  assert.equal(monthName(1).toLowerCase(), "janeiro");
  assert.equal(monthName(13), "—");
  assert.equal(monthName(1.5), "—");
});

test("academic year uses start/end civil dates and never rewrites the start year", () => {
  assert.equal(formatAnoLetivoDisplay({ ano: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31" }), "2026/2027");
  assert.equal(formatAnoLetivoDisplay(2026), "2026/2027");
  assert.equal(formatAnoLetivoDisplay({ ano: 2026, data_inicio: "2026-09-01T00:00:00Z", data_fim: "2027-08-31T00:00:00Z" }), "2026/2027");
});
