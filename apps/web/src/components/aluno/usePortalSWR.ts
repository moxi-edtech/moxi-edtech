"use client";

import { useCallback, useEffect, useRef } from "react";

const inFlight = new Map<string, Promise<unknown>>();
const lastAt = new Map<string, number>();

type Options<T> = {
  key: string;
  url: string;
  intervalMs?: number;
  minGapMs?: number;
  parse: (payload: unknown) => T;
  onData: (data: T) => void;
  onError?: (message: string) => void;
};

export function usePortalSWR<T>({ key, url, intervalMs = 45000, minGapMs = 1200, parse, onData, onError }: Options<T>) {
  const abortRef = useRef<AbortController | null>(null);
  const parseRef = useRef(parse);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    parseRef.current = parse;
    onDataRef.current = onData;
    onErrorRef.current = onError;
  }, [parse, onData, onError]);

  const fetchNow = useCallback(
    async (force = false) => {
      const now = Date.now();
      const prev = lastAt.get(key) ?? 0;
      if (!force && now - prev < minGapMs) return;
      lastAt.set(key, now);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const run = inFlight.get(key) ??
        fetch(url, { cache: "no-store", signal: controller.signal })
          .then((r) => r.json())
          .finally(() => inFlight.delete(key));

      inFlight.set(key, run);

      try {
        const payload = await run;
        onDataRef.current(parseRef.current(payload));
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : "Falha ao atualizar";
        onErrorRef.current?.(message);
      }
    },
    [key, minGapMs, url],
  );

  useEffect(() => {
    void fetchNow(true);
    const onFocus = () => void fetchNow();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void fetchNow(), intervalMs);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [fetchNow, intervalMs]);

  return {
    refresh: () => fetchNow(true),
  };
}
