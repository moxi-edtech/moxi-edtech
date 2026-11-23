"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PROXIMOS_PASSOS } from "./constants";
import { Passo, ContextoAcao } from "./types";
import { FileCheck2, KeyRound, GraduationCap, Wallet, Plus, Printer, Receipt, Users } from "lucide-react";

interface PassoCardProps {
  passo: Passo;
  onEscolher: (passo: Passo) => void;
  index: number;
}

function PassoCard({ passo, onEscolher, index }: PassoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onEscolher(passo)}
      onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{ animationDelay: index * 60 + "ms" }}
      className={"group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-[background-color,border-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold " + (
        passo.destaque
          ? "border-klasse-gold bg-klasse-gold text-klasse-gold-900 hover:brightness-95"
          : "border-border bg-card text-foreground hover:border-klasse-gold/50 hover:bg-muted"
      )}
    >
      <span
        aria-hidden="true"
        className={"flex size-9 shrink-0 items-center justify-center rounded-xl " + (
          passo.destaque ? "bg-klasse-gold-900/10 text-klasse-gold-900" : "bg-klasse-green/10 text-klasse-green dark:text-emerald-300"
        )}
      >
        <PassoIcon id={passo.id} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{passo.label}</span>
        <span className={"block text-xs " + (passo.destaque ? "text-klasse-gold-900/80" : "text-muted-foreground")}>
          {passo.desc}
        </span>
      </span>
      <span className="text-base transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
    </button>
  );
}

function PassoIcon({ id }: { id: string }) {
  const Icon = id.includes("boletim") ? FileCheck2
    : id.includes("portal") ? KeyRound
    : id.includes("notas") ? GraduationCap
    : id.includes("propina") ? Wallet
    : id.includes("pagamento") ? Receipt
    : id.includes("imprimir") ? Printer
    : id.includes("documento") ? FileCheck2
    : id.includes("nova") || id.includes("proxima") ? Plus
    : id.includes("lista") ? Users
    : FileCheck2;
  return <Icon size={16} strokeWidth={2.4} />;
}

interface FluxoPosAccaoProps {
  acaoId: string;
  contexto: ContextoAcao;
  onEscolher: (passo: Passo, contexto: ContextoAcao) => void;
  onDismiss: () => void;
}

export default function FluxoPosAccao({ acaoId, contexto, onEscolher, onDismiss }: FluxoPosAccaoProps) {
  const [visivel, setVisivel] = useState(false);
  const config = PROXIMOS_PASSOS[acaoId];

  useEffect(() => {
    if (config) {
      const t = setTimeout(() => setVisivel(true), 80);
      return () => clearTimeout(t);
    }
  }, [config]);

  const handleDismiss = useCallback(() => {
    setVisivel(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleEscolher = useCallback((passo: Passo) => {
    setVisivel(false);
    setTimeout(() => onEscolher(passo, contexto), 200);
  }, [onEscolher, contexto]);

  if (!config) return null;

  return (
    <div
      className="transition-[opacity,transform] duration-300"
      style={{ opacity: visivel ? 1 : 0, transform: visivel ? "translateY(0)" : "translateY(12px)" }}
    >
      <section className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm" aria-label={config.titulo}>
        <div className="flex items-center justify-between gap-2 border-b border-klasse-green/20 bg-klasse-green/10 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-klasse-green text-sm font-bold text-white">✓</span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-klasse-green dark:text-emerald-300">{config.titulo}</h3>
              <p className="text-xs text-muted-foreground">{config.subtitulo(contexto)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar próximos passos"
            className="rounded-xl p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que fazer a seguir?</p>
          <div className="space-y-2">
            {config.passos.map((passo, index) => (
              <PassoCard key={passo.id} passo={passo} onEscolher={handleEscolher} index={index} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
