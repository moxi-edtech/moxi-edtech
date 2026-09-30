import type { SchoolOperatingProfile } from "./types";

export function canUseRecurringTuition(profile: SchoolOperatingProfile) {
  return profile.financeModel === "tuition";
}

export function canUseFinancialSuspension(profile: SchoolOperatingProfile) {
  return profile.financeModel === "tuition";
}

export function canUseFinanceChargeMessages(profile: SchoolOperatingProfile) {
  return profile.financeModel === "tuition";
}

export function canUseBudgetModule(profile: SchoolOperatingProfile) {
  return profile.financeModel === "budget";
}

export function canUseEmoluments(profile: SchoolOperatingProfile) {
  return profile.financeModel === "emoluments_only" || profile.financeModel === "mixed";
}
