"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";
import { createBalcaoTelemetry } from "@/lib/balcao/balcaoTelemetry";

/** Component-scoped, opt-in, non-identifying aggregated performance counters. */
export function useBalcaoTelemetry(activeAction: BalcaoActionId) {
  const telemetry = useMemo(() => createBalcaoTelemetry({
    enabled: process.env.NEXT_PUBLIC_BALCAO_ANONYMOUS_METRICS === "true",
    // No sender configured: there is NO network, until a privacy-reviewed
    // aggregate-only collector with no IP recording is provided.
  }), []);
  const navStarted = useRef<number | null>(null);
  const markNavigationStart = useCallback(() => {
    if (telemetry.enabled && typeof performance !== "undefined") navStarted.current=performance.now();
  }, [telemetry]);
  useEffect(() => {
    if (navStarted.current===null) return;
    const start=navStarted.current;
    navStarted.current=null;
    const frame=requestAnimationFrame(()=>{
      telemetry.count({action:activeAction,durationMs:Math.max(0,performance.now()-start)});
    });
    return ()=>cancelAnimationFrame(frame);
  }, [activeAction,telemetry]);
  return { markNavigationStart };
}
