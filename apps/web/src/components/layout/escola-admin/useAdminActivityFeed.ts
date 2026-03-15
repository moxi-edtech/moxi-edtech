"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityFeedItem } from "@/lib/admin/activityFeed";

type FeedResponse = {
  ok: boolean;
  items: ActivityFeedItem[];
  nextCursor: string | null;
};

type RealtimeState = "live" | "polling";

const POLLING_MS = 15_000;
const WS_TIMEOUT_MS = 12_000;
const REALTIME_THROTTLE_MS = 2_000;

const parseEnvMs = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function useAdminActivityFeed(escolaId: string, limit = 20) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("live");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const wsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRealtimeFetchRef = useRef(0);
  const pollingMs = useMemo(
    () => parseEnvMs(process.env.NEXT_PUBLIC_ACTIVITY_FEED_POLL_MS, POLLING_MS),
    []
  );
  const wsTimeoutMs = useMemo(
    () => parseEnvMs(process.env.NEXT_PUBLIC_ACTIVITY_FEED_WS_TIMEOUT_MS, WS_TIMEOUT_MS),
    []
  );
  const realtimeThrottleMs = useMemo(
    () => parseEnvMs(process.env.NEXT_PUBLIC_ACTIVITY_FEED_THROTTLE_MS, REALTIME_THROTTLE_MS),
    []
  );

  const feedUrl = useMemo(
    () => `/api/escola/${escolaId}/admin/activity-feed?limit=${Math.min(Math.max(limit, 1), 50)}`,
    [escolaId, limit]
  );

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch(feedUrl, { cache: "no-store" });
      const json: FeedResponse = await res.json();
      if (!res.ok || !json.ok) throw new Error("Falha ao carregar feed");
      setItems(json.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar feed");
    } finally {
      setLoading(false);
    }
  }, [feedUrl]);

  const pollIncremental = useCallback(async () => {
    await fetchBootstrap();
  }, [fetchBootstrap]);

  const handleRealtimeUpdate = useCallback(async () => {
    const now = Date.now();
    if (now - lastRealtimeFetchRef.current < realtimeThrottleMs) return;
    lastRealtimeFetchRef.current = now;
    await fetchBootstrap();
  }, [fetchBootstrap, realtimeThrottleMs]);

  useEffect(() => {
    void fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-activity-${escolaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_activity_events",
          filter: `escola_id=eq.${escolaId}`,
        },
        () => {
          setRealtimeState("live");
          if (wsTimeoutRef.current) clearTimeout(wsTimeoutRef.current);
          wsTimeoutRef.current = setTimeout(() => setRealtimeState("polling"), wsTimeoutMs);
          void handleRealtimeUpdate();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeState("live");
          if (wsTimeoutRef.current) clearTimeout(wsTimeoutRef.current);
          wsTimeoutRef.current = setTimeout(() => setRealtimeState("polling"), wsTimeoutMs);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeState("polling");
        }
      });

    return () => {
      if (wsTimeoutRef.current) clearTimeout(wsTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [escolaId, handleRealtimeUpdate, supabase, wsTimeoutMs]);

  useEffect(() => {
    if (realtimeState !== "polling") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(() => {
      void pollIncremental();
    }, pollingMs);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollIncremental, realtimeState, pollingMs]);

  return {
    items,
    loading,
    error,
    realtimeState,
  };
}
