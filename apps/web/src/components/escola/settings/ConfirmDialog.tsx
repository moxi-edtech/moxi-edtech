"use client";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
        </div>
        <div className="p-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cx(
              "rounded-full px-4 py-2 text-xs font-semibold text-white",
              danger ? "bg-red-600 hover:brightness-95" : "bg-klasse-gold hover:brightness-95"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
