"use client";
import { useSyncExternalStore } from "react";
const query = "(max-width: 767px)";
function subscribe(listener: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
export function usePortalMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
