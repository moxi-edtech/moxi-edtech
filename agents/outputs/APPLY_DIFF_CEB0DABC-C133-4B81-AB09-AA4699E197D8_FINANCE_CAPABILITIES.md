# Apply diff — finance capabilities

run_id: CEB0DABC-C133-4B81-AB09-AA4699E197D8

```diff
diff --git a/apps/web/src/lib/school-profile/finance-capabilities.ts b/apps/web/src/lib/school-profile/finance-capabilities.ts
new file mode 100644
index 000000000..9b38f4db0
--- /dev/null
+++ b/apps/web/src/lib/school-profile/finance-capabilities.ts
@@ -0,0 +1,21 @@
+import type { SchoolOperatingProfile } from "./types";
+
+export function canUseRecurringTuition(profile: SchoolOperatingProfile) {
+  return profile.financeModel === "tuition";
+}
+
+export function canUseFinancialSuspension(profile: SchoolOperatingProfile) {
+  return profile.financeModel === "tuition";
+}
+
+export function canUseFinanceChargeMessages(profile: SchoolOperatingProfile) {
+  return profile.financeModel === "tuition";
+}
+
+export function canUseBudgetModule(profile: SchoolOperatingProfile) {
+  return profile.financeModel === "budget";
+}
+
+export function canUseEmoluments(profile: SchoolOperatingProfile) {
+  return profile.financeModel === "emoluments_only" || profile.financeModel === "mixed";
+}
```
