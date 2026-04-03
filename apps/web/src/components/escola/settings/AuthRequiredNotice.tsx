"use client";

import Link from "next/link";
import { AlertTriangle, LogIn } from "lucide-react";

type AuthRequiredNoticeProps = {
  nextPath: string;
  className?: string;
  title?: string;
  description?: string;
  compact?: boolean;
};

export default function AuthRequiredNotice({
  nextPath,
  className,
  title = "Sessão expirada",
  description = "Faça login novamente para continuar.",
  compact = false,
}: AuthRequiredNoticeProps) {
  return (
    <div className={className}>
      <div
        className={`rounded-2xl border border-klasse-gold-200 bg-white p-6 shadow-sm ${
          compact ? "" : "w-full max-w-xl"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-klasse-gold-50 p-2 text-klasse-gold-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">{description}</p>
            <div className="pt-1 flex flex-wrap gap-2">
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="inline-flex items-center gap-2 rounded-md bg-klasse-gold-600 px-3 py-2 text-sm font-semibold text-white hover:bg-klasse-gold-700"
              >
                <LogIn className="h-4 w-4" />
                Entrar novamente
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
