"use client";

import React from "react";
import { ESTADOS_VAZIOS } from "./constants";
import * as LucideIcons from "lucide-react";

interface EstadoVazioProps {
  tipo: string;
  onAcao?: (acaoId: string) => void;
}

export default function EstadoVazio({ tipo, onAcao }: EstadoVazioProps) {
  const config = ESTADOS_VAZIOS[tipo];
  if (!config) return null;

  // Keep the existing icon lookup contract for server-provided empty states.
  const IconComponent = (LucideIcons as any)[config.icone] || LucideIcons.HelpCircle;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-sm">
        <IconComponent size={28} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="mb-1.5 text-base font-bold tracking-tight text-foreground">{config.titulo}</h3>
      <p className={"max-w-[260px] text-sm leading-relaxed text-muted-foreground " + (config.acao ? "mb-6" : "")}>
        {config.desc}
      </p>
      {config.acao && (
        <button
          type="button"
          onClick={() => onAcao?.(config.acao!.id)}
          className="rounded-xl bg-klasse-gold px-7 py-2.5 text-sm font-bold text-klasse-gold-900 shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold"
        >
          {config.acao.label}
        </button>
      )}
    </div>
  );
}
