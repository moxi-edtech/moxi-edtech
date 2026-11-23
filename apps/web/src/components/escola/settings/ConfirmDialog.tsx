"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ConfirmDialog({
  title,
  desc,
  confirmLabel = "Confirmar",
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  desc?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-klasse-dark/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${danger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
              {danger ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              {desc && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>}
            </div>
          </div>
        </div>
        <div className="p-4 bg-muted border-t border-border flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="rounded-full px-6"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            tone={danger ? "red" : "gold"}
            className="rounded-full px-8 shadow-sm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
