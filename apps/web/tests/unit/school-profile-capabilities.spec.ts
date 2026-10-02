import assert from "node:assert/strict";
import test from "node:test";

import {
  PRIVATE_DEFAULT_PROFILE,
  isValidSchoolFinanceCombination,
  type FinanceModel,
  type SchoolOperatingProfile,
} from "../../src/lib/school-profile/types";
import {
  canUseBudgetModule,
  canUseEmoluments,
  canUseFinanceChargeMessages,
  canUseFinancialSuspension,
  canUseOneOffStudentPayments,
  canUseRecurringTuition,
  canUseStudentFinancePortal,
} from "../../src/lib/school-profile/finance-capabilities";

const profile = (financeModel: FinanceModel): SchoolOperatingProfile => ({
  ...PRIVATE_DEFAULT_PROFILE("school-1"),
  financeModel,
});

test("public schools cannot be configured with recurring tuition", () => {
  assert.equal(isValidSchoolFinanceCombination("public", "tuition"), false);
  assert.equal(isValidSchoolFinanceCombination("public", "budget"), true);
  assert.equal(isValidSchoolFinanceCombination("public", "emoluments_only"), true);
  assert.equal(isValidSchoolFinanceCombination("public", "mixed"), true);
});

test("tuition model keeps legacy recurring and one-off finance", () => {
  const value = profile("tuition");
  assert.equal(canUseRecurringTuition(value), true);
  assert.equal(canUseFinancialSuspension(value), true);
  assert.equal(canUseFinanceChargeMessages(value), true);
  assert.equal(canUseStudentFinancePortal(value), true);
  assert.equal(canUseOneOffStudentPayments(value), true);
  assert.equal(canUseEmoluments(value), true);
});

test("budget model has no transactional student finance", () => {
  const value = profile("budget");
  assert.equal(canUseRecurringTuition(value), false);
  assert.equal(canUseFinancialSuspension(value), false);
  assert.equal(canUseFinanceChargeMessages(value), false);
  assert.equal(canUseStudentFinancePortal(value), false);
  assert.equal(canUseOneOffStudentPayments(value), false);
  assert.equal(canUseBudgetModule(value), true);
});

test("emoluments_only and mixed never infer recurring tuition", () => {
  for (const model of ["emoluments_only", "mixed"] as const) {
    const value = profile(model);
    assert.equal(canUseRecurringTuition(value), false);
    assert.equal(canUseFinancialSuspension(value), false);
    assert.equal(canUseFinanceChargeMessages(value), false);
    assert.equal(canUseStudentFinancePortal(value), true);
    assert.equal(canUseOneOffStudentPayments(value), true);
    assert.equal(canUseEmoluments(value), true);
  }
});
