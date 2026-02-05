"use client";

import { AlertTriangle, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  reasonCode: string;
  reasonDetail: string | null;
};

export function MotivoBloqueioModal({ open, onClose, reasonCode, reasonDetail }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="font-bold text-slate-900">Serviço bloqueado</div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-50">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-700" />
            <div>
              <div className="text-sm font-bold text-rose-900">{reasonCode}</div>
              {reasonDetail ? (
                <div className="mt-1 text-xs text-rose-800/80">{reasonDetail}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Próximo passo: resolver a causa (pagar débitos / completar documentos / aguardar aprovação).
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
