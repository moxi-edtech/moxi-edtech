"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { FiscalCockpit } from "@/components/fiscal/FiscalCockpit";
import { FiscalEmissaoModal } from "@/components/fiscal/FiscalEmissaoModal";
import { FiscalLedgerTable } from "@/components/fiscal/FiscalLedgerTable";
import { FiscalOnboarding } from "@/components/fiscal/FiscalOnboarding";
import type { FiscalDoc } from "@/components/fiscal/types";

type DocumentosApiResponse = {
  ok?: boolean;
  data?: {
    empresa_id?: string | null;
    docs?: FiscalDoc[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type ComplianceApiResponse = {
  ok?: boolean;
  data?: {
    empresa_id?: string | null;
    metrics?: {
      series_ativas?: number;
      chaves_ativas?: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export const dynamic = "force-dynamic";

export default function FinanceiroFiscalPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [docs, setDocs] = useState<FiscalDoc[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [seriesAtivas, setSeriesAtivas] = useState(0);
  const [chavesAtivas, setChavesAtivas] = useState(0);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [openEmissaoModal, setOpenEmissaoModal] = useState(false);

  const loadFiscalData = async (cancelledRef?: { cancelled: boolean }) => {
    const isCancelled = () => cancelledRef?.cancelled === true;

    setLoading(true);
    setErrorMessage(null);
    try {
      const [documentosRes, complianceRes] = await Promise.all([
        fetch("/api/fiscal/documentos", { method: "GET", cache: "no-store" }),
        fetch("/api/fiscal/compliance/status", { method: "GET", cache: "no-store" }),
      ]);

      const docsJson = (await documentosRes.json().catch(() => ({}))) as DocumentosApiResponse;
      const complianceJson = (await complianceRes.json().catch(() => ({}))) as ComplianceApiResponse;

      if (isCancelled()) return;

      if (!documentosRes.ok || docsJson.ok !== true) {
        setErrorMessage(docsJson.error?.message ?? "Não foi possível carregar o módulo fiscal.");
        return;
      }

      const resolvedEmpresaId = docsJson.data?.empresa_id ?? complianceJson.data?.empresa_id ?? null;
      const resolvedSeriesAtivas = complianceJson.data?.metrics?.series_ativas ?? 0;
      const resolvedChavesAtivas = complianceJson.data?.metrics?.chaves_ativas ?? 0;

      setEmpresaId(resolvedEmpresaId);
      setDocs(Array.isArray(docsJson.data?.docs) ? docsJson.data.docs : []);
      setSeriesAtivas(resolvedSeriesAtivas);
      setChavesAtivas(resolvedChavesAtivas);
      setNeedsSetup(
        !resolvedEmpresaId || resolvedSeriesAtivas <= 0 || resolvedChavesAtivas <= 0
      );
    } catch {
      if (isCancelled()) return;
      setErrorMessage("Não foi possível carregar o módulo fiscal.");
    } finally {
      if (isCancelled()) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    void loadFiscalData(cancelledRef);

    return () => {
      cancelledRef.cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="grid min-h-[60vh] place-items-center rounded-xl border border-slate-200 bg-white">
          <div className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar compliance fiscal...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-sora text-2xl font-semibold text-slate-900">Módulo Fiscal</h1>
            <p className="mt-1 text-sm text-slate-500">
              Emita documentos, acompanhe os registos e mantenha tudo em conformidade no portal da escola.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenEmissaoModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18542e]"
          >
            <Plus className="h-4 w-4" />
            Nova Emissão Fiscal
          </button>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </section>
      ) : needsSetup ? (
        <FiscalOnboarding
          empresaId={empresaId}
          seriesAtivas={seriesAtivas}
          chavesAtivas={chavesAtivas}
          onSuccess={async () => {
            await loadFiscalData();
          }}
        />
      ) : (
        <>
          <FiscalCockpit empresaId={empresaId} />
          <FiscalLedgerTable docs={docs} />
        </>
      )}

      {openEmissaoModal ? (
        <FiscalEmissaoModal
          onClose={() => setOpenEmissaoModal(false)}
          onCreated={(doc) => setDocs((prev) => [doc, ...prev])}
        />
      ) : null}
    </main>
  );
}
