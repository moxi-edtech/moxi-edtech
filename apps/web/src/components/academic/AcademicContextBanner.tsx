"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ACADEMIC_YEAR_PARAM, type AcademicWorkspaceContext } from "@/lib/academic-year/context";

export default function AcademicContextBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const yearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [context, setContext] = useState<AcademicWorkspaceContext | null>(null);

  useEffect(() => {
    if (!yearId) {
      return;
    }
    let cancelled = false;
    fetch(`/api/academic-context?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(yearId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setContext(json?.ok ? json.context : null);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      });
    return () => { cancelled = true; };
  }, [yearId]);

  if (!yearId || !context || (context.mode !== "HISTORICAL_READ" && !context.warnings?.length)) return null;

  const isPlanned = context.status === "PLANNED";
  const message = context.warnings?.includes("MULTIPLE_ACTIVE_ACADEMIC_YEARS")
    ? "Atenção administrativa: existem vários anos letivos ativos. O sistema está a usar o ano com data de início mais recente."
    : isPlanned
    ? `Ano letivo ${context.anoLetivoLabel} · Ainda não iniciado. Você está a consultar dados de preparação. As ações de edição estão bloqueadas.`
    : `Ano letivo ${context.anoLetivoLabel} · Encerrado. Você está a consultar informações históricas. As ações de edição estão bloqueadas.`;

  async function goToCurrentYear() {
    const response = await fetch("/api/academic-context", { cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (json?.ok && json.context?.anoLetivoId) {
      router.replace(`${pathname}?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(json.context.anoLetivoId)}`);
    }
  }

  return (
    <div role="alert" aria-live="polite" className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span className="flex-1">{message}</span>
        {context.mode === "HISTORICAL_READ" && (
          <button type="button" onClick={goToCurrentYear} className="rounded-md border border-amber-800 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100">
            Voltar ao ano atual
          </button>
        )}
      </div>
    </div>
  );
}
