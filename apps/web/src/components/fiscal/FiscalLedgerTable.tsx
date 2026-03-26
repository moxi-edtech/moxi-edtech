"use client";

import type { FiscalDoc, FiscalDocStatus } from "@/components/fiscal/types";
import { FiscalRowActions } from "@/components/fiscal/FiscalRowActions";

type FiscalLedgerTableProps = {
  docs: FiscalDoc[];
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
    return "border-green-200 bg-green-50 text-[#1F6B3B]";
  }
  if (status === "RETIFICADO") {
    return "border-yellow-200 bg-yellow-50 text-[#92400e]";
  }
  return "border-red-200 bg-red-50 text-red-700";
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

export function FiscalLedgerTable({ docs }: FiscalLedgerTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  Sem documentos fiscais para este contexto.
                </td>
              </tr>
            ) : (
              docs.map((doc) => {
                const isAnulado = doc.status === "ANULADO";
                const muted = isAnulado ? "text-slate-400 line-through" : "text-slate-700";
                const hashShort = doc.hash_control ? `${doc.hash_control.slice(0, 8)}...` : "-";

                return (
                  <tr key={doc.id} className="border-b border-slate-100 transition hover:bg-slate-50/50">
                    <td className={`px-4 py-3 ${muted}`}>{formatDate(doc.emitido_em)}</td>
                    <td className={`px-4 py-3 font-sora font-semibold text-slate-900 ${isAnulado ? "line-through text-slate-400" : ""}`}>
                      {doc.numero}
                    </td>
                    <td className={`px-4 py-3 ${muted}`}>{doc.cliente_nome}</td>
                    <td className={`px-4 py-3 ${muted}`}>{kwanza.format(doc.total_aoa)}</td>
                    <td
                      className={`px-4 py-3 text-xs text-slate-500 ${isAnulado ? "line-through text-slate-400" : ""}`}
                      style={{ fontFamily: "Geist Mono, monospace" }}
                      title={doc.hash_control}
                    >
                      {hashShort}
                    </td>
                    <td className="px-4 py-3">
                      <FiscalStatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <FiscalRowActions doc={doc} onRefresh={() => window.location.reload()} />
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
