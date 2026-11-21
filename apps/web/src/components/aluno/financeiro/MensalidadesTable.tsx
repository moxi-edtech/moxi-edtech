"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { OperationalTableEmptyState, OperationalTableErrorState, OperationalTableSkeleton } from "@/components/ui/OperationalTableStates";
import { formatDate, formatKwanza } from "@/lib/formatters";

type Mensalidade = {
  id: string;
  competencia: string;
  /** Outstanding amount returned by /api/aluno/financeiro, in AOA. */
  valor: number;
  vencimento: string;
  status: string;
  pago_em: string | null;
};

export function MensalidadesTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Mensalidade[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const year = new Date().getFullYear();
        const params = new URLSearchParams({ fromAno: String(year - 4), toAno: String(year) });
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/aluno/financeiro?${params}`, { cache: "no-store", signal: controller.signal });
        const json = await res.json();
        if (!res.ok || json?.ok !== true || !Array.isArray(json.mensalidades)) {
          throw new Error(json?.error || "Falha ao carregar mensalidades.");
        }
        if (!controller.signal.aborted) setRows(json.mensalidades);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : "Falha ao carregar mensalidades.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [retryKey]);

  if (loading) return <OperationalTableSkeleton columns={5} rows={4} label="A carregar mensalidades" />;
  if (error) return <OperationalTableErrorState description={error} onRetry={() => setRetryKey((key) => key + 1)} />;
  if (!rows.length) return <OperationalTableEmptyState title="Nenhuma mensalidade encontrada" description="Não existem mensalidades para o período consultado." />;

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-[680px] w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Competência</th>
            <th scope="col" className="px-4 py-3">Por pagar (Kz)</th>
            <th scope="col" className="px-4 py-3">Vencimento</th>
            <th scope="col" className="px-4 py-3">Estado</th>
            <th scope="col" className="px-4 py-3">Pago em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((m) => (
            <tr key={m.id} className="text-foreground hover:bg-muted/30">
              <td className="px-4 py-3">{m.competencia}</td>
              <td className="px-4 py-3 tabular-nums">{formatKwanza(m.valor)}</td>
              <td className="px-4 py-3">{formatDate(m.vencimento)}</td>
              <td className="px-4 py-3"><StatusPill status={m.status} variant="financeiro" /></td>
              <td className="px-4 py-3">{formatDate(m.pago_em)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{rows.length} mensalidade(s) no período consultado</p>
    </div>
  );
}
