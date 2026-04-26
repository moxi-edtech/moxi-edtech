"use client";

import type { FunnelEventPayload } from "@/lib/funnel-log";

export function trackFunnelClient(payload: Omit<FunnelEventPayload, "path">) {
  const body = JSON.stringify({
    ...payload,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/formacao/funnel", blob);
    return;
  }

  void fetch("/api/formacao/funnel", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body,
    keepalive: true,
    cache: "no-store",
  });
}
