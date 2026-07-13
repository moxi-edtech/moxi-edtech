"use client";

import { useEffect, useState } from "react";
import { listActions } from "@/lib/offline/store";
import { useOfflineStatus } from "./useOfflineStatus";

export function useOfflineQueueStatus() {
  const { online } = useOfflineStatus();
  const [status, setStatus] = useState({
    total: 0,
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
  });

  useEffect(() => {
    let active = true;

    async function checkQueue() {
      try {
        const queue = await listActions();
        if (!active) return;

        const counts = {
          total: queue.length,
          pending: 0,
          syncing: 0,
          failed: 0,
          conflict: 0,
        };

        for (const item of queue) {
          if (item.status === "syncing") {
            counts.syncing++;
          } else if (item.status === "conflict") {
            counts.conflict++;
          } else if (item.status === "failed") {
            counts.failed++;
          } else {
            counts.pending++;
          }
        }

        setStatus(counts);
      } catch (err) {
        console.error("Failed to read offline queue status:", err);
      }
    }

    checkQueue();

    // Poll every 3 seconds to keep UI responsive to queue modifications
    const interval = setInterval(checkQueue, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [online]);

  return status;
}
