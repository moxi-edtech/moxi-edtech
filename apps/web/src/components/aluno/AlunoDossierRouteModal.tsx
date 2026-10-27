"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type AlunoDossierRouteModalProps = {
  children: React.ReactNode;
};

export function AlunoDossierRouteModal({ children }: AlunoDossierRouteModalProps) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aluno-dossier-modal-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) router.back();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
          <div>
            <h2 id="aluno-dossier-modal-title" className="text-base font-bold text-foreground">
              Ficha do aluno
            </h2>
            <p className="text-xs text-muted-foreground">Perfil, histórico, financeiro e documentos</p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Fechar ficha do aluno"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
