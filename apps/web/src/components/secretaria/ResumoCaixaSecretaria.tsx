"use client";

import { useEffect, useState } from "react";
import { Wallet, Receipt } from "lucide-react";
import { formatKwanza } from "@/lib/formatters";
import {
  OperationalMetricCard,
  OperationalMetricSkeleton,
} from "@/components/shared/OperationalMetricCard";

type CaixaSummary = {
  cobrado_hoje?: number | string | null;
  recibos_emitidos?: number | string | null;
};

function amount(value: number | string | null | undefined): number | null {
  if (value == null || (typeof value === "string" && !value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ResumoCaixaSecretaria({
  escolaId,
  refreshKey = 0,
}: {
  escolaId: string;
  /** Refresh after a successful payment; the key also scopes pending reads. */
  refreshKey?: number;
}) {
  const [retryKey, setRetryKey] = useState(0);
  const scope = JSON.stringify([escolaId, refreshKey, retryKey]);
  const [result, setResult] = useState<{
    scope: string;
    data: CaixaSummary | null;
    error: boolean;
  } | null>(null);
  const isLoading = result?.scope !== scope;
  const data = result?.scope === scope ? result.data : null;
  const error = result?.scope === scope && result.error;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch(
      `/api/secretaria/balcao/resumo-caixa?escolaId=${encodeURIComponent(escolaId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body?.ok)
          throw new Error("Resumo de caixa indisponível");
        if (active) setResult({ scope, data: body, error: false });
      })
      .catch(() => {
        if (active) setResult({ scope, data: null, error: true });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [escolaId, scope]);

  const gridClass = "grid min-w-0 gap-4 @min-[520px]:grid-cols-2";

  if (isLoading)
    return (
      <div style={{ containerType: "inline-size" }}>
        <div
          role="status"
          aria-label="A carregar resumo de caixa"
          className={gridClass}
        >
          {[0, 1].map((key) => (
            <OperationalMetricSkeleton key={key} />
          ))}
        </div>
      </div>
    );

  const received = error ? null : amount(data?.cobrado_hoje);
  return (
    <div className="min-w-0 space-y-3" style={{ containerType: "inline-size" }}>
      <div className={gridClass}>
        <OperationalMetricCard
          label="Cobrado por mim"
          value={received == null ? null : formatKwanza(received)}
          icon={Wallet}
          description="Recebimentos de hoje do funcionário autenticado"
        />
        <OperationalMetricCard
          label="Recibos emitidos"
          value={error ? null : amount(data?.recibos_emitidos)}
          icon={Receipt}
          description="Hoje"
        />
      </div>
      {error && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
        >
          <p>Não foi possível actualizar o caixa.</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="min-h-10 rounded-xl border border-border px-3 font-medium text-foreground hover:bg-muted"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
