"use client";

import { useMemo } from "react";
import {
  PLAN_FEATURES,
  PLAN_NAMES,
  type FeatureKey,
  type PlanTier,
  parsePlanTier,
} from "@/config/plans";
import { useUser } from "@/hooks/useUser";

export function usePlanFeature(feature: FeatureKey) {
  const { user, loading, error, escola } = useUser();

  const currentPlan: PlanTier = useMemo(() => {
    return parsePlanTier(escola?.plano_atual ?? (user as any)?.escola?.plano_atual);
  }, [escola?.plano_atual, (user as any)?.escola?.plano_atual]);

  const isEnabled = !loading && (PLAN_FEATURES[currentPlan]?.[feature] ?? false);
  const enabledReason = loading ? "loading" : isEnabled ? "ok" : "not_allowed";

  return {
    isEnabled,
    enabledReason,
    currentPlan,
    planName: PLAN_NAMES[currentPlan],
    upgradeRequired: !loading && !isEnabled,
    loading,
    error,
  };
}
