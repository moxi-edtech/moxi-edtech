import type { SchoolOperatingProfile } from "./types";

export function canUseOfficialDocumentProfile(profile: SchoolOperatingProfile) {
  return profile.documentProfile !== "med_angola_pending";
}
