"use client";

import { useOfflineSync } from "@/hooks/useOfflineSync";

export function OfflineSyncRegister() {
  useOfflineSync();
  return null;
}
