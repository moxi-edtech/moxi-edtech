import type { SchoolOperatingProfile } from "./types";

export function canUseCustomAssessmentRules(profile: SchoolOperatingProfile) {
  return profile.assessmentPolicy === "custom";
}

export function canUseAutomaticLegalAssessment(profile: SchoolOperatingProfile) {
  // V0.1 has no approved policy registry/evidence gate yet. A named
  // regulatory profile alone must never activate a legal decision engine.
  void profile;
  return false;
}
