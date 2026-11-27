"use client";

import { Calendar, Clock, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PortalCulturalSignature } from "@/components/portal/ui/PortalWelcomeCard";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";

type EstadoVital = {
  escola_id: string;
  session_id: string | null;
  ano_ativo: number | null;
  periodo_id: string | null;
  periodo_tipo: string | null;
  periodo_numero: number | null;
  hoje_bloqueado_pedagogico: boolean;
  evento_hoje_nome: string | null;
  fase_operacional: 'PRE_INICIO' | 'REGULAR' | 'EXAMES' | 'POS_ENCERRAMENTO';
};

export function EstadoVitalBanner({ estado, compact = false, calendarHref, showSignature = true }: { estado: EstadoVital | null; compact?: boolean; calendarHref?: string; showSignature?: boolean }) {
  const [openedEventKey, setOpenedEventKey] = useState<string | null>(null);
  if (!estado) return null;
  const eventKey = JSON.stringify([estado.escola_id, estado.session_id, estado.periodo_id, estado.evento_hoje_nome]);
  const eventOpen = openedEventKey === eventKey;

  const isExames = estado.fase_operacional === 'EXAMES';
  const isBoundary = estado.fase_operacional === 'PRE_INICIO' || estado.fase_operacional === 'POS_ENCERRAMENTO';
  const isBloqueado = estado.hoje_bloqueado_pedagogico || isBoundary;
  const faseLabel = isBoundary
    ? estado.fase_operacional === 'PRE_INICIO' ? 'Pré-início' : 'Encerrado'
    : isExames ? 'Exames' : 'Aulas';

  if (compact) {
    const periodo = estado.periodo_tipo?.toUpperCase() === "TRIMESTRE" && estado.periodo_numero
      ? estado.periodo_numero + "º Trimestre"
      : [estado.periodo_tipo, estado.periodo_numero].filter(Boolean).join(" ") || "Intervalo";
    return (
      <>
        <section aria-label="Estado académico" data-testid="operations-academic-card" className="klasse-welcome-card klasse-operations-academic-card min-w-0 overflow-hidden rounded-xl">
          <div className="px-4 py-3">
            <div data-testid="operations-academic-row" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">{estado.ano_ativo ?? "—"} · {periodo}</span>
                <span>{isBloqueado && !isBoundary ? "Interrupção" : faseLabel}</span>
                <span className={isBloqueado ? "font-medium text-red-900" : undefined}>{isBloqueado ? "Diário bloqueado" : "Diário liberado"}</span>
              </div>
              {calendarHref && <Link href={calendarHref} className="inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">Calendário académico <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></Link>}
            </div>
            {estado.evento_hoje_nome && (isBloqueado || isExames ? (
              <p className="mt-2 break-words text-sm font-medium">{estado.evento_hoje_nome}</p>
            ) : (
              <button type="button" aria-haspopup="dialog" aria-expanded={eventOpen} onClick={() => setOpenedEventKey(eventKey)}
                className="mt-2 flex min-h-6 w-fit max-w-full items-center gap-1 rounded-sm text-xs underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" /> Evento de hoje
              </button>
            ))}
          </div>
          {showSignature && <PortalCulturalSignature />}
        </section>
        <PortalSheet open={eventOpen && Boolean(estado.evento_hoje_nome) && !isBloqueado && !isExames} onClose={() => setOpenedEventKey(null)} title="Evento de hoje" description={`${estado.ano_ativo ?? "—"} · ${periodo}`} size="compact">
          <p className="break-words text-base font-semibold text-foreground">{estado.evento_hoje_nome}</p>
          <p className="text-sm text-muted-foreground">{faseLabel} · Diário liberado</p>
        </PortalSheet>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Lado Esquerdo: Título e Status Resumido */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-border bg-muted p-2 text-muted-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado Académico</p>
          <p className="text-xs font-bold text-foreground mt-0.5">
            {estado.evento_hoje_nome ? `Hoje: ${estado.evento_hoje_nome}` : 'Operação regular'}
          </p>
        </div>
      </div>

      {/* Lado Direito: As 4 Métricas em Formato Inline Minimalista */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {/* Metrica 1 */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Ano:</span>
          <span className="font-bold text-foreground">{estado.ano_ativo || '—'}</span>
        </div>

        {/* Metrica 2 */}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Período:</span>
          <span className="font-bold text-foreground">
            {estado.periodo_tipo ? `${estado.periodo_tipo} ${estado.periodo_numero || ''}` : 'Intervalo'}
          </span>
        </div>

        {/* Metrica 3 (Fase como Pill suave) */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Fase:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            isExames ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
          }`}>
            {isBloqueado && !isBoundary ? 'Interrupção' : faseLabel}
          </span>
        </div>

        {/* Metrica 4 (Status Diário como Pill suave) */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Diário:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            isBloqueado ? 'bg-rose-50 text-rose-700 border border-rose-100/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
          }`}>
            {isBloqueado ? 'Bloqueado' : 'Liberado'}
          </span>
        </div>
      </div>
    </div>
  );
}
