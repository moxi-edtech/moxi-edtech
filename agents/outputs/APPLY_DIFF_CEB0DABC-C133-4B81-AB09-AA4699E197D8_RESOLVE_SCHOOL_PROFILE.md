# Apply diff — school profile resolver

run_id: CEB0DABC-C133-4B81-AB09-AA4699E197D8

```diff
diff --git a/apps/web/src/lib/school-profile/resolve-school-profile.ts b/apps/web/src/lib/school-profile/resolve-school-profile.ts
new file mode 100644
index 000000000..fdefbdacc
--- /dev/null
+++ b/apps/web/src/lib/school-profile/resolve-school-profile.ts
@@ -0,0 +1,80 @@
+import "server-only";
+
+import type { SupabaseClient } from "@supabase/supabase-js";
+import type { DBWithRPC } from "@/types/supabase-augment";
+import { PRIVATE_DEFAULT_PROFILE, type AssessmentPolicyKey, type SchoolOperatingProfile } from "./types";
+
+type ProfileRow = {
+  id: string;
+  school_id: string;
+  school_sector: "private" | "public";
+  finance_model: "tuition" | "budget" | "emoluments_only" | "mixed";
+  assessment_policy: AssessmentPolicyKey;
+  regulatory_profile: string;
+  document_profile: string;
+  effective_from: string;
+  effective_until: string | null;
+  status: SchoolOperatingProfile["status"];
+};
+
+type CacheEntry = { profile: SchoolOperatingProfile; expiresAt: number };
+
+const PROFILE_CACHE_TTL_MS = 60 * 1000;
+const profileCache = new Map<string, CacheEntry>();
+
+function mapProfile(row: ProfileRow): SchoolOperatingProfile {
+  return {
+    id: row.id,
+    schoolId: row.school_id,
+    schoolSector: row.school_sector,
+    financeModel: row.finance_model,
+    assessmentPolicy: row.assessment_policy,
+    regulatoryProfile: row.regulatory_profile,
+    documentProfile: row.document_profile,
+    effectiveFrom: row.effective_from,
+    effectiveUntil: row.effective_until,
+    status: row.status,
+  };
+}
+
+export function invalidateSchoolOperatingProfile(schoolId: string) {
+  for (const key of profileCache.keys()) {
+    if (key.startsWith(`${schoolId}:`)) profileCache.delete(key);
+  }
+}
+
+export async function resolveSchoolOperatingProfile(
+  supabase: SupabaseClient<DBWithRPC>,
+  schoolId: string,
+  options: { bypassCache?: boolean; asOf?: Date } = {},
+): Promise<SchoolOperatingProfile> {
+  const asOf = options.asOf ?? new Date();
+  const effectiveDate = asOf.toISOString().slice(0, 10);
+  const cacheKey = `${schoolId}:${effectiveDate}`;
+  const cached = profileCache.get(cacheKey);
+  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.profile;
+
+  const { data, error } = await (supabase as any)
+    .from("school_operating_profiles")
+    .select("id,school_id,school_sector,finance_model,assessment_policy,regulatory_profile,document_profile,effective_from,effective_until,status")
+    .eq("school_id", schoolId)
+    .eq("status", "active")
+    .lte("effective_from", effectiveDate)
+    .or(`effective_until.is.null,effective_until.gte.${effectiveDate}`)
+    .order("effective_from", { ascending: false })
+    .limit(1)
+    .maybeSingle();
+
+  if (error && error.code !== "42P01") throw error;
+
+  const profile = data ? mapProfile(data as ProfileRow) : PRIVATE_DEFAULT_PROFILE(schoolId);
+  if (!options.bypassCache) {
+    profileCache.set(cacheKey, { profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
+  }
+  return profile;
+}
```
