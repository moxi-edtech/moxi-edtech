"use client";

import { useMemo } from "react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export function OfflineBanner({
  fromCache,
  updatedAt,
}: {
  fromCache: boolean;
  updatedAt?: string | null;
}) {
  const { online } = useOfflineStatus();
  const label = useMemo(() => {
    if (!updatedAt) return "Dados locais";
    const date = new Date(updatedAt);
    return `Dados locais (última atualização ${date.toLocaleString("pt-PT")})`;
  }, [updatedAt]);

  if (online && !fromCache) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      {online ? label : "Sem internet. Exibindo dados salvos localmente."}
    </div>
  );
}
