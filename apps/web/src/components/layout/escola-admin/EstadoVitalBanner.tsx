"use client";

import { Calendar, Clock, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";

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

export function EstadoVitalBanner({ estado, compact = false, calendarHref }: { estado: EstadoVital | null; compact?: boolean; calendarHref?: string }) {
  if (!estado) return null;

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
      <section aria-label="Estado académico" className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">{estado.ano_ativo ?? "—"} · {periodo}</span>
            <span className="text-muted-foreground">{isBloqueado && !isBoundary ? "Interrupção" : faseLabel}</span>
            <span className={isBloqueado ? "font-medium text-rose-600 dark:text-rose-300" : "text-emerald dark:text-emerald-300"}>{isBloqueado ? "Diário bloqueado" : "Diário liberado"}</span>
          </div>
          {calendarHref && <Link href={calendarHref} className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline">Calendário académico <ChevronRight className="h-3.5 w-3.5" /></Link>}
        </div>
        {estado.evento_hoje_nome && (isBloqueado || isExames ? (
          <p className="mt-2 text-sm font-medium text-foreground">{estado.evento_hoje_nome}</p>
        ) : (
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer hover:text-foreground">Evento de hoje</summary>
            <p className="mt-1 break-words">{estado.evento_hoje_nome}</p>
          </details>
        ))}
      </section>
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
