"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ModoSecretaria = "balcao" | "financeiro";

function normalizeModo(value: string | null | undefined): ModoSecretaria | null {
  if (value === "balcao" || value === "financeiro") return value;
  return null;
}

export default function KlasseSecretariaUnificada({
  balcaoContent,
  financeiroContent,
}: {
  balcaoContent: React.ReactNode;
  financeiroContent: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modeFromQuery = normalizeModo(searchParams?.get("modo"));
  const [activeMode, setActiveMode] = useState<ModoSecretaria>(modeFromQuery ?? "balcao");

  useEffect(() => {
    if (modeFromQuery) {
      setActiveMode(modeFromQuery);
      try {
        localStorage.setItem("klasse_modo_secretaria", modeFromQuery);
      } catch {}
      return;
    }

    try {
      const saved = normalizeModo(localStorage.getItem("klasse_modo_secretaria"));
      if (saved && searchParams) {
        setActiveMode(saved);
        const next = new URLSearchParams(searchParams.toString());
        next.set("modo", saved);
        router.replace(`${pathname}?${next.toString()}`);
      }
    } catch {}
  }, [modeFromQuery, pathname, router, searchParams]);

  const setMode = (mode: ModoSecretaria) => {
    setActiveMode(mode);
    try {
      localStorage.setItem("klasse_modo_secretaria", mode);
    } catch {}
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.set("modo", mode);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const current = useMemo(() => (activeMode === "financeiro" ? financeiroContent : balcaoContent), [activeMode, balcaoContent, financeiroContent]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setMode("balcao")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeMode === "balcao"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Balcão
        </button>
        <button
          type="button"
          onClick={() => setMode("financeiro")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeMode === "financeiro"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Financeiro
        </button>
      </div>

      {current}
    </div>
  );
}
