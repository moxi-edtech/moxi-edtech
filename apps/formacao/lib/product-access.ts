import type { TenantType } from "@/lib/navigation-engine";

type ProductAccessDecision =
  | { action: "allow" }
  | { action: "deny"; reason: "product_mismatch" };

export function decideProductAccess(tenantType: TenantType, pathname: string): ProductAccessDecision {
  if (tenantType === "SOLO_CREATOR") {
    return { action: "deny", reason: "product_mismatch" };
  }

  if (pathname.startsWith("/mentor")) {
    return { action: "deny", reason: "product_mismatch" };
  }

  return { action: "allow" };
}
