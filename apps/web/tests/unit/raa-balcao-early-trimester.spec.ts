import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isSourceInEarlyTrimester } from "../../src/lib/rematricula/raa-balcao-early-trimester";

const periods = [
  { numero: 1, offering_id: "regular", data_inicio: "2026-09-01", data_fim: "2026-12-19" },
  { numero: 2, offering_id: "regular", data_inicio: "2027-01-11", data_fim: "2027-03-31" },
  { numero: 3, offering_id: "regular", data_inicio: "2027-04-05", data_fim: "2027-07-20" },
];
test("first and second official trimester block early progression only for matching course", () => {
  assert.equal(isSourceInEarlyTrimester({ today: "2026-10-10", periods, offeringId: "regular" }), true);
  assert.equal(isSourceInEarlyTrimester({ today: "2027-02-10", periods, offeringId: "regular" }), true);
  assert.equal(isSourceInEarlyTrimester({ today: "2027-05-10", periods, offeringId: "regular" }), false);
  assert.equal(isSourceInEarlyTrimester({ today: "2027-08-10", periods, offeringId: "regular" }), false);
});
test("other offering, missing calendar and overlaps never become invented source phases", () => {
  assert.equal(isSourceInEarlyTrimester({ today: "2026-10-10", periods, offeringId: "technical" }), false);
  assert.equal(isSourceInEarlyTrimester({ today: "2026-10-10", periods: [], offeringId: "regular" }), false);
  assert.equal(isSourceInEarlyTrimester({ today: "2026-10-10", periods: [periods[0], periods[0]], offeringId: "regular" }), false);
});
test("a single generic MED trimester can be used without course-specific rows", () => {
  const generic = [{ numero: 2, offering_id: null, data_inicio: "2027-01-01", data_fim: "2027-03-01" }];
  assert.equal(isSourceInEarlyTrimester({ today: "2027-02-01", periods: generic, offeringId: null }), true);
});
test("GET and canonical POST apply the same early-trimester rule", () => {
  const source = (p: string) => readFileSync(resolve(process.cwd(), "src", p), "utf8");
  const status = source("app/api/secretaria/balcao/rematriculas/status/route.ts");
  const writer = source("app/api/secretaria/balcao/rematriculas/route.ts");
  assert.match(status, /isSourceYearStillInEarlyTrimester/);
  assert.match(status, /trimestreInicialEmCurso/);
  assert.match(writer, /isSourceYearStillInEarlyTrimester/);
  assert.match(writer, /ACADEMIC_YEAR_IN_PROGRESS/);
});
