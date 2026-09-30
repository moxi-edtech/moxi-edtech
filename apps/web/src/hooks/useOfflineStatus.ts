"use client";

import { useEffect, useState } from "react";

export function useOfflineStatus() {
  // O primeiro render precisa ser igual no servidor e no cliente.
  // A leitura de navigator.onLine acontece depois da hidratação.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    queueMicrotask(() => setOnline(navigator.onLine));
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { online };
}
