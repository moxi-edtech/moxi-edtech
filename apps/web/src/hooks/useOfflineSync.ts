"use client";

import { useEffect } from "react";
import { processOfflineQueue } from "@/lib/offline/queue";

export function useOfflineSync() {
  useEffect(() => {
    const runSync = () => {
      processOfflineQueue().catch(() => undefined);
    };

    runSync();
    window.addEventListener("online", runSync);
    return () => window.removeEventListener("online", runSync);
  }, []);
}
