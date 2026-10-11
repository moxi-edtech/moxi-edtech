import assert from "node:assert/strict";
import test from "node:test";
import { resolveTargetAcademicYear } from "../../src/lib/academico/target-academic-year";

test("no active year targets the calendar template base", () => {
  assert.equal(resolveTargetAcademicYear(2027, null), 2027);
});

test("rollover never targets the active academic year itself", () => {
  assert.equal(resolveTargetAcademicYear(2027, 2027), 2028);
  assert.equal(resolveTargetAcademicYear(2028, 2027), 2028);
  assert.equal(resolveTargetAcademicYear(2030, 2027), 2030);
});

test("invalid calendar and active-year input fails closed", () => {
  assert.throws(() => resolveTargetAcademicYear(NaN, 2027));
  assert.throws(() => resolveTargetAcademicYear(2027, 2101));
});
