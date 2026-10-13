import type { SchoolOperatingProfile } from "./types";

export type SchoolFinanceCapabilities = {
  recurringTuition: boolean;
  financialSuspension: boolean;
  financeChargeMessages: boolean;
  budgetModule: boolean;
  emoluments: boolean;
  studentFinancePortal: boolean;
  oneOffStudentPayments: boolean;
};

export function deriveSchoolFinanceCapabilities(
  profile: SchoolOperatingProfile,
): SchoolFinanceCapabilities {
  const recurringTuition = profile.financeModel === "tuition";
  const emoluments =
    profile.financeModel === "tuition" ||
    profile.financeModel === "emoluments_only" ||
    profile.financeModel === "mixed";

  return {
    recurringTuition,
    financialSuspension: recurringTuition,
    financeChargeMessages: recurringTuition,
    budgetModule: profile.financeModel === "budget",
    emoluments,
    studentFinancePortal: profile.financeModel !== "budget",
    oneOffStudentPayments: emoluments,
  };
}

export function canUseRecurringTuition(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).recurringTuition;
}

export function canUseFinancialSuspension(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).financialSuspension;
}

export function canUseFinanceChargeMessages(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).financeChargeMessages;
}

export function canUseBudgetModule(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).budgetModule;
}

export function canUseEmoluments(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).emoluments;
}

export function canUseStudentFinancePortal(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).studentFinancePortal;
}

export function canUseOneOffStudentPayments(profile: SchoolOperatingProfile) {
  return deriveSchoolFinanceCapabilities(profile).oneOffStudentPayments;
}
