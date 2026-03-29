"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { SAFTExportModal } from "@/components/fiscal/SAFTExportModal";
import { FiscalSaftHistory } from "@/components/fiscal/FiscalSaftHistory";
import { FiscalPendingReprocessCard } from "@/components/fiscal/FiscalPendingReprocessCard";
import type { ComplianceStatus } from "@/components/fiscal/types";

type FiscalCockpitProps = {
  empresaId: string | null;
};

type ComplianceApiResponse = {
  ok?: boolean;
  data?: {
    kms?: {
      probeStatus?: string;
    };
    metrics?: {
      series_ativas?: number;
    };
  };
};

export function FiscalCockpit({ empresaId }: FiscalCockpitProps) {
  const [openSaftModal, setOpenSaftModal] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [health, setHealth] = useState<ComplianceStatus | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      setLoadingHealth(true);
      try {
        const response = await fetch("/api/fiscal/compliance/status?probe=1", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await response.json().catch(() => null)) as ComplianceApiResponse | null;

        if (cancelled) return;

        if (!response.ok || json?.ok !== true) {
          setHealth({
            status: "error",
            kms_online: false,
            serie_activa: false,
            message: "Falha na Ligação KMS. Contacte Suporte.",
          });
          return;
        }

        const kmsOnline = json.data?.kms?.probeStatus === "ok";
        const serieAtiva = (json.data?.metrics?.series_ativas ?? 0) > 0;

        setHealth({
          status: kmsOnline ? "ok" : "error",
          kms_online: kmsOnline,
          serie_activa: serieAtiva,
          message: kmsOnline
            ? "Motor Criptográfico: Operacional"
            : "Falha na Ligação KMS. Contacte Suporte.",
        });
      } catch (error) {
        console.error("Falha ao obter compliance fiscal", error);
        if (cancelled) return;

        setHealth({
          status: "error",
          kms_online: false,
          serie_activa: false,
          message: "Falha na Ligação KMS. Contacte Suporte.",
        });
      } finally {
        if (cancelled) return;
        setLoadingHealth(false);
      }
    };

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-sora text-2xl font-semibold text-slate-900">Compliance Fiscal AGT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Infraestrutura blindada e certificada SAF-T(AO)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenSaftModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18542e]"
        >
          {loadingExport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loadingExport ? "A gerar..." : "Exportar SAF-T(AO)"}
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {loadingHealth ? (
          <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
        ) : health?.status === "ok" ? (
          <div className="inline-flex items-center gap-2 text-sm text-slate-700">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
            <span>Motor Criptográfico: Operacional</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm text-red-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>Falha na Ligação KMS. Contacte Suporte.</span>
          </div>
        )}
      </div>

      <FiscalPendingReprocessCard empresaId={empresaId} />

      <FiscalSaftHistory empresaId={empresaId} refreshKey={historyRefreshKey} />

      {openSaftModal ? (
        <SAFTExportModal
          empresaId={empresaId}
          onClose={() => setOpenSaftModal(false)}
          onSubmittingChange={setLoadingExport}
          onSuccess={() => setHistoryRefreshKey((prev) => prev + 1)}
        />
      ) : null}
    </section>
  );
}
