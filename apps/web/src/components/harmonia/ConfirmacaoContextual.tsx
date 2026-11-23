"use client";

import React, { useState, useEffect } from "react";
import { PROXIMOS_PASSOS } from "./constants";
import { ContextoAcao } from "./types";

interface ConfirmacaoContextualProps {
  acaoId: string;
  contexto: ContextoAcao;
  onClose: () => void;
}

export default function ConfirmacaoContextual({ acaoId, contexto, onClose }: ConfirmacaoContextualProps) {
  const config = PROXIMOS_PASSOS[acaoId];
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSaindo(true);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!config) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[999] flex w-[calc(100vw-3rem)] max-w-[340px] items-center gap-3 rounded-xl border border-klasse-green/30 bg-klasse-green p-4 text-white shadow-sm transition-[opacity,transform] duration-300"
      style={{ opacity: saindo ? 0 : 1, transform: saindo ? "translateY(8px)" : "translateY(0)" }}
    >
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">✓</span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-sm font-bold">{config.titulo}</div>
        <div className="truncate text-xs text-emerald-100">{config.subtitulo(contexto)}</div>
      </div>
      <button
        type="button"
        onClick={() => { setSaindo(true); setTimeout(onClose, 300); }}
        aria-label="Fechar confirmação"
        className="shrink-0 rounded-xl p-1 text-emerald-100 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold"
      >
        ×
      </button>
    </div>
  );
}
