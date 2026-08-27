# Apply diff — school profile guards

run_id: CEB0DABC-C133-4B81-AB09-AA4699E197D8

```diff
diff --git a/apps/web/src/lib/school-profile/guards.ts b/apps/web/src/lib/school-profile/guards.ts
new file mode 100644
@@ -0,0 +1,28 @@
+import type { SchoolOperatingProfile } from "./types";
+import { canUseFinanceChargeMessages, canUseFinancialSuspension, canUseRecurringTuition } from "./finance-capabilities";
+export const FINANCE_MODEL_NOT_SUPPORTED = "FINANCE_MODEL_NOT_SUPPORTED" as const;
+export type FinanceGuardFailure = { ok: false; code: typeof FINANCE_MODEL_NOT_SUPPORTED; error: string };
+export type FinanceGuardResult = { ok: true } | FinanceGuardFailure;
+const unsupportedFinanceOperation = (): FinanceGuardFailure => ({ ok: false, code: FINANCE_MODEL_NOT_SUPPORTED, error: "Esta operação não está disponível para o modelo financeiro desta escola." });
+export function requireRecurringTuition(profile: SchoolOperatingProfile): FinanceGuardResult { return canUseRecurringTuition(profile) ? { ok: true } : unsupportedFinanceOperation(); }
+export function requireFinancialSuspension(profile: SchoolOperatingProfile): FinanceGuardResult { return canUseFinancialSuspension(profile) ? { ok: true } : unsupportedFinanceOperation(); }
+export function requireFinanceChargeMessages(profile: SchoolOperatingProfile): FinanceGuardResult { return canUseFinanceChargeMessages(profile) ? { ok: true } : unsupportedFinanceOperation(); }
```
