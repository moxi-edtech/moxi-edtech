"use client";

import { useMemo } from "react";
import {
  PLAN_FEATURES,
  PLAN_NAMES,
  type FeatureKey,
  type PlanTier,
  parsePlanTier,
} from "@/config/plans";
import { useUser, type UserMetadata } from "@/hooks/useUser";

export function usePlanFeature(feature: FeatureKey) {
  const { user, loading, error, escola } = useUser();

  const userPlan = useMemo(() => {
    const metadata = user?.app_metadata as UserMetadata | undefined;
    return metadata?.escola?.plano_atual ?? null;
  }, [user?.app_metadata]);

  const currentPlan: PlanTier = useMemo(() => {
    return parsePlanTier(escola?.plano_atual ?? userPlan);
  }, [escola?.plano_atual, userPlan]);

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
