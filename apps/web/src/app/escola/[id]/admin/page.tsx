export const dynamic = 'force-dynamic'

import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard"

"use client";

import { useEffect, useState } from "react";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [escolaNome, setEscolaNome] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { id } = await props.params;
      if (!mounted) return;
      setEscolaId(id);

      const cacheKey = "admin:dashboard:summary";
      const cacheRaw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
      if (cacheRaw) {
        const cached = JSON.parse(cacheRaw) as { ts: number; payload: any };
        if (cached?.payload?.escola?.nome) {
          setEscolaNome(cached.payload.escola.nome);
          return;
        }
      }

      try {
        const res = await fetch("/api/admin/dashboard/summary", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (mounted && res.ok && json?.ok && json?.escola?.nome) {
          setEscolaNome(json.escola.nome);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload: json }));
          }
        }
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, [props.params]);

  if (!escolaId) return null;
  return <EscolaAdminDashboard escolaId={escolaId} escolaNome={escolaNome} />;
}
