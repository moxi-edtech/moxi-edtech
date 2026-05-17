"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLAN_NAMES,
  type FeatureKey,
  type PlanTier,
  normalizePlanFeatureFlags,
  parsePlanTier,
} from "@/config/plans";
import { useUser, type UserMetadata } from "@/hooks/useUser";

export function usePlanFeature(feature: FeatureKey) {
  const { user, loading, error, escola } = useUser();
  const [planLimits, setPlanLimits] = useState<Record<string, boolean> | null>(null);

  const userPlan = useMemo(() => {
    const metadata = user?.app_metadata as UserMetadata | undefined;
    return metadata?.escola?.plano_atual ?? null;
  }, [user?.app_metadata]);

  const currentPlan: PlanTier = useMemo(() => {
    return parsePlanTier(escola?.plano_atual ?? userPlan);
  }, [escola?.plano_atual, userPlan]);

  useEffect(() => {
    const escolaId = escola?.id ?? null;
    if (!escolaId) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/escolas/${escolaId}/plano`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.limites == null) return;
        if (active) setPlanLimits(normalizePlanFeatureFlags(json.limites as Record<string, boolean> | null) ?? null);
      } catch {
        if (active) setPlanLimits(null);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [escola?.id]);

  const fromLimits = planLimits && typeof planLimits[feature] === "boolean"
    ? (planLimits[feature] as boolean)
    : null;

  const isEnabled = !loading && (fromLimits ?? true);
  const enabledReason = loading ? "loading" : "ok";

  return {
    isEnabled,
    enabledReason,
    currentPlan,
    planName: PLAN_NAMES[currentPlan],
    upgradeRequired: false,
    loading,
    error,
  };
}
