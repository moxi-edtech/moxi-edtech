"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleX, FileDown, PencilRuler } from "lucide-react";

import { AnularModal } from "@/components/fiscal/AnularModal";
import type { FiscalDoc } from "@/components/fiscal/types";

type FiscalRowActionsProps = {
  doc: FiscalDoc;
  onRefresh: () => void;
};

export function FiscalRowActions({ doc, onRefresh }: FiscalRowActionsProps) {
  const router = useRouter();
  const [openAnular, setOpenAnular] = useState(false);

  if (doc.status === "ANULADO") {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => window.open(`/api/fiscal/documentos/${doc.id}/pdf`, "_blank", "noopener,noreferrer")}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          title="Imprimir/PDF fiscal"
          aria-label="Imprimir/PDF fiscal"
        >
          <FileDown className="h-4 w-4" />
        </button>

        {(doc.status === "EMITIDO" || doc.status === "RETIFICADO") && (
          <button
            type="button"
            onClick={() => setOpenAnular(true)}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Anular"
            aria-label="Anular documento"
          >
            <CircleX className="h-4 w-4" />
          </button>
        )}

        {doc.status === "EMITIDO" && (
          <button
            type="button"
            onClick={() => router.push(`/financeiro/fiscal/retificar/${doc.id}`)}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-green-50 hover:text-[#1F6B3B]"
            title="Retificar"
            aria-label="Retificar documento"
          >
            <PencilRuler className="h-4 w-4" />
          </button>
        )}
      </div>

      {openAnular ? (
        <AnularModal
          docId={doc.id}
          onSuccess={onRefresh}
          onClose={() => setOpenAnular(false)}
        />
      ) : null}
    </>
  );
}
