export const SCHOOL_SECTORS = ["private", "public"] as const;
export type SchoolSector = (typeof SCHOOL_SECTORS)[number];

export const FINANCE_MODELS = ["tuition", "budget", "emoluments_only", "mixed"] as const;
export type FinanceModel = (typeof FINANCE_MODELS)[number];

export const ASSESSMENT_POLICIES = [
  "custom",
  "med_angola_pending",
  "med_angola_primary_pending",
  "med_angola_secondary_pending",
] as const;
export type AssessmentPolicyKey = (typeof ASSESSMENT_POLICIES)[number];

export type SchoolOperatingProfile = {
  id?: string;
  schoolId: string;
  schoolSector: SchoolSector;
  financeModel: FinanceModel;
  assessmentPolicy: AssessmentPolicyKey;
  regulatoryProfile: string;
  documentProfile: string;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  status?: "draft" | "scheduled" | "active" | "expired" | "archived";
};

export const PRIVATE_DEFAULT_PROFILE = (schoolId: string): SchoolOperatingProfile => ({
  schoolId,
  schoolSector: "private",
  financeModel: "tuition",
  assessmentPolicy: "custom",
  regulatoryProfile: "angola_private_default",
  documentProfile: "private_default",
  status: "active",
});

export function isPublicSchool(profile: SchoolOperatingProfile) {
  return profile.schoolSector === "public";
}
