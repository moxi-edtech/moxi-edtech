"use client";

import { useRouter } from "next/navigation";

import type { FiscalDoc, FiscalDocStatus } from "@/components/fiscal/types";
import { FiscalRowActions } from "@/components/fiscal/FiscalRowActions";

type FiscalLedgerTableProps = {
  docs: FiscalDoc[];
  onRefresh: () => void;
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

const dateFormat = new Intl.DateTimeFormat("pt-AO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function statusBadgeClass(status: FiscalDocStatus) {
  if (status === "EMITIDO") {
    return "border-emerald/30 bg-emerald/10 text-foreground";
  }
  if (status === "RETIFICADO") {
    return "border-amber/40 bg-amber/10 text-foreground";
  }
  return "border-destructive/40 bg-destructive/10 text-foreground";
}

function FiscalStatusBadge({ status }: { status: FiscalDocStatus }) {
  return (
    <span className={`inline-flex rounded-xl border px-2 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "-";
  return dateFormat.format(value);
}

export function FiscalLedgerTable({ docs, onRefresh }: FiscalLedgerTableProps) {
  const router = useRouter();

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Documento</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Hash</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Acções</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Sem documentos fiscais para este contexto.
                </td>
              </tr>
            ) : (
              docs.map((doc) => {
                const isAnulado = doc.status === "ANULADO";
                const muted = isAnulado ? "text-muted-foreground line-through" : "text-foreground/80";
                const hashShort = doc.hash_control ? `${doc.hash_control.slice(0, 8)}...` : "-";

                return (
                  <tr key={doc.id} className="border-b border-border transition hover:bg-muted/50">
                    <td className={`px-4 py-3 ${muted}`}>{formatDate(doc.emitido_em)}</td>
                    <td className={`px-4 py-3 font-sora font-semibold text-foreground ${isAnulado ? "line-through text-muted-foreground" : ""}`}>
                      {doc.numero}
                    </td>
                    <td className={`px-4 py-3 ${muted}`}>{doc.cliente_nome}</td>
                    <td className={`px-4 py-3 ${muted}`}>{kwanza.format(doc.total_aoa)}</td>
                    <td
                      className={`px-4 py-3 text-xs text-muted-foreground ${isAnulado ? "line-through text-muted-foreground" : ""}`}
                      style={{ fontFamily: "Geist Mono, monospace" }}
                      title={doc.hash_control}
                    >
                      {hashShort}
                    </td>
                    <td className="px-4 py-3">
                      <FiscalStatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <FiscalRowActions
                        doc={doc}
                        onRefresh={() => {
                          onRefresh();
                          router.refresh();
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
