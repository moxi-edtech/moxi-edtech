import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { turmaEnrollmentPolicy, turmaPageRange } from "../../src/lib/command-center/turma-explorer-policy";

describe("turma explorer policy", () => {
  it("counts active-year enrollment without transferred/pending records", () => {
    assert.deepEqual(turmaEnrollmentPolicy(false), { statuses: ["ativo"], requireActive: true });
  });
  it("includes concluded cohorts in historic read, without transferred students", () => {
    assert.deepEqual(turmaEnrollmentPolicy(true), { statuses: ["ativo", "concluido"], requireActive: false });
  });
  it("paginates after the legacy 50-row limit without overlap", () => {
    assert.deepEqual(turmaPageRange(1), { from: 0, to: 19 });
    assert.deepEqual(turmaPageRange(3), { from: 40, to: 59 });
    assert.deepEqual(turmaPageRange(6), { from: 100, to: 119 });
  });
  it("rejects invalid page and size", () => {
    assert.throws(() => turmaPageRange(0), RangeError);
    assert.throws(() => turmaPageRange(-1), RangeError);
    assert.throws(() => turmaPageRange(1, 101), RangeError);
    assert.throws(() => turmaPageRange(1.5), RangeError);
  });
});
