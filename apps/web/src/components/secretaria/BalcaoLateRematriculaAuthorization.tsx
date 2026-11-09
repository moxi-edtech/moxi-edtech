"use client";

import { useState } from "react";
import { CalendarClock, Loader2, ShieldCheck } from "lucide-react";

export function BalcaoLateRematriculaAuthorization({
  matriculaId, anoLetivoId, onRecheck,
}: {
  matriculaId: string;
  anoLetivoId: string;
  onRecheck: () => Promise<unknown>;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const authorize = async () => {
    if (motivo.trim().length < 12 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/secretaria/balcao/rematriculas/fora-prazo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matriculaId,
          ano_letivo_id: anoLetivoId,
          motivo: motivo.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || "A autorização não foi registada.");
      }
      setDone(true);
      setMotivo("");
      try { await onRecheck(); } catch {
        setError("Autorização registada. Verifique novamente a elegibilidade antes de concluir.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na autorização fora do prazo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Rematrícula individual fora de prazo" className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-emerald" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Confirmar rematrícula fora do prazo</h3>
      </div>
      {done ? (
        <p role="status" className="flex items-center gap-2 text-xs text-emerald">
          <ShieldCheck className="h-4 w-4" /> Autorização individual registada. Continue a confirmação com os requisitos académicos e financeiros habituais.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Não precisa reabrir as rematrículas de toda a escola. Justifique apenas esta operação.
          </p>
          <label className="block space-y-1 text-xs font-medium text-foreground">
            Motivo da confirmação excecional
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
              rows={2} maxLength={500} placeholder="Ex.: Regularização excecional autorizada pela escola"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => void authorize()}
            disabled={saving || motivo.trim().length < 12}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Autorizar e continuar
          </button>
        </>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
