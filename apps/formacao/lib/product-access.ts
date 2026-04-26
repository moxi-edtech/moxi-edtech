import type { TenantType } from "@/lib/navigation-engine";

type ProductAccessDecision =
  | { action: "allow" }
  | { action: "redirect"; target: string; reason: "legacy_admin_namespace_redirect" }
  | { action: "deny"; reason: "product_mismatch" };

const SOLO_LEGACY_ADMIN_REDIRECTS: Array<{ sourcePrefix: string; target: string }> = [
  { sourcePrefix: "/admin/cohorts", target: "/mentor/mentorias" },
  { sourcePrefix: "/admin/mentorias", target: "/mentor/mentorias" },
  { sourcePrefix: "/admin/dashboard", target: "/mentor/dashboard" },
  { sourcePrefix: "/admin", target: "/mentor/dashboard" },
];

function resolveSoloLegacyAdminTarget(pathname: string): string | null {
  for (const rule of SOLO_LEGACY_ADMIN_REDIRECTS) {
    if (pathname.startsWith(rule.sourcePrefix)) return rule.target;
  }
  return null;
}

export function decideProductAccess(tenantType: TenantType, pathname: string): ProductAccessDecision {
  if (tenantType === "SOLO_CREATOR") {
    const legacyTarget = resolveSoloLegacyAdminTarget(pathname);
    if (legacyTarget) {
      return { action: "redirect", target: legacyTarget, reason: "legacy_admin_namespace_redirect" };
    }
  }

  if (tenantType === "SOLO_CREATOR") {
    if (pathname.startsWith("/secretaria") || pathname.startsWith("/financeiro")) {
      return { action: "deny", reason: "product_mismatch" };
    }
    return { action: "allow" };
  }

  if (pathname.startsWith("/mentor")) {
    return { action: "deny", reason: "product_mismatch" };
  }

  return { action: "allow" };
}
