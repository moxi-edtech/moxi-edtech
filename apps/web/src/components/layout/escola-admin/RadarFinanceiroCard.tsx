"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import type { InadimplenciaTopRow } from "./dashboard.types";

const moeda = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

type RadarFinanceiroCardProps = {
  items: InadimplenciaTopRow[];
  linkHref: string;
  isOperacoes?: boolean;
  /** ISO timestamp of when the data was last fetched */
  lastUpdated?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Severity = "critico" | "atencao" | "recente";

function getSeverity(diasAtraso: number): Severity {
  if (diasAtraso > 60) return "critico";
  if (diasAtraso >= 30) return "atencao";
  return "recente";
}

/** Relative time formatter — "há 5min", "há 2h", "ontem", "há 3 dias" */
function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 1) return "agora mesmo";
    if (diffMins < 60) return `há ${diffMins}min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return "ontem";
    if (diffDays < 30) return `há ${diffDays} dias`;
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
  } catch {
    return dateString;
  }
}

/** Format lastUpdated for footer — "hoje às 09:30" or relative */
function formatFreshness(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `hoje às ${date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return formatRelativeTime(dateString);
  } catch {
    return dateString;
  }
}

const SEVERITY_CONFIG = {
  critico: {
    avatar: "bg-red-50 text-red-700",
    DayIcon: TrendingUp,
    dayColor: "text-red-700",
    pillBg: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    label: "Crítico",
  },
  atencao: {
    avatar: "bg-klasse-gold-50 text-klasse-gold-700",
    DayIcon: Minus,
    dayColor: "text-klasse-gold-600",
    pillBg: "bg-klasse-gold-50 text-klasse-gold-600 border-klasse-gold-100",
    dot: "bg-klasse-gold-400",
    label: "Atenção",
  },
  recente: {
    avatar: "bg-slate-100 text-slate-600",
    DayIcon: TrendingDown,
    dayColor: "text-slate-500",
    pillBg: "bg-slate-50 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    label: "Recente",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadarFinanceiroCard({ items, linkHref, isOperacoes, lastUpdated }: RadarFinanceiroCardProps) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const contextualLinkHref = isOperacoes
    ? linkHref.replace("/financeiro/radar", "/operacoes/turmas-alunos")
    : linkHref;
  const totalAlunos = items.length;
  const totalEmRisco = items.reduce((acc, item) => acc + (item.valor_em_atraso || 0), 0);

  // Severity counts
  const severityCounts = items.reduce(
    (counts, item) => {
      counts[getSeverity(item.dias_em_atraso)] += 1;
      return counts;
    },
    { critico: 0, atencao: 0, recente: 0 } as Record<Severity, number>
  );
  const { critico: countCritico, atencao: countAtencao, recente: countRecente } = severityCounts;

  const displayItems = items.slice(0, 5);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col transition hover:shadow-md h-full ${isOperacoes ? "ring-1 ring-slate-100" : ""}`}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-klasse-gold-50 text-klasse-gold-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Radar Financeiro</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {totalAlunos > 0 ? (
                  <span>{totalAlunos} aluno{totalAlunos !== 1 ? "s" : ""} • {moeda.format(totalEmRisco)} em risco</span>
                ) : (
                  <span>Monitorização de inadimplência</span>
                )}
              </p>
            </div>
          </div>
          {totalAlunos > 0 && (
            <Link
              href={contextualLinkHref}
              className="text-[11px] font-bold uppercase tracking-wider text-klasse-green hover:underline flex items-center gap-0.5 mt-1 shrink-0"
            >
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Severity breakdown pills */}
        {totalAlunos > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-[52px]">
            {([
              { key: "critico" as Severity, count: countCritico },
              { key: "atencao" as Severity, count: countAtencao },
              { key: "recente" as Severity, count: countRecente },
            ]).filter(s => s.count > 0).map(({ key, count }) => {
              const cfg = SEVERITY_CONFIG[key];
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${cfg.pillBg}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {totalAlunos === 0 ? (
          /* Celebratory empty state — §4 Graciosidade */
          <div className="flex flex-col items-center justify-center flex-1 min-h-[220px] p-6 text-center border-t border-klasse-green-100 bg-klasse-green-50/30">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-klasse-green-50 text-klasse-green border border-klasse-green-100 shadow-sm">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Inadimplência Zero</h4>
            <p className="text-xs text-slate-500 mb-5 max-w-[240px] leading-relaxed">
              Nenhum aluno com atraso no período actual. Continue assim.
            </p>
            <Link
              href={contextualLinkHref}
              className="text-xs font-bold text-klasse-green hover:text-klasse-green-700 transition-colors flex items-center gap-1 group"
            >
              Ver histórico de cobranças
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <ul className="divide-y divide-slate-100">
              {displayItems.map((item, index) => {
                const severity = getSeverity(item.dias_em_atraso);
                const cfg = SEVERITY_CONFIG[severity];
                const DayIcon = cfg.DayIcon;

                const nome = item.aluno_nome?.trim() || "Aluno";
                const initials = nome
                  .split(" ")
                  .filter((n) => n.length > 0)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?";

                const contexto = [item.classe_nome, item.turma_nome].filter(Boolean).join(" – ");

                return (
                  <motion.li
                    key={item.aluno_id || index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex flex-col flex-wrap sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedItemId((current) => current === item.aluno_id ? null : item.aluno_id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klasse-green focus-visible:ring-offset-2"
                      aria-label={`Ver detalhes da dívida de ${nome}`}
                      aria-expanded={expandedItemId === item.aluno_id}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${cfg.avatar}`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover:text-klasse-green transition-colors">
                          {nome}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${cfg.dayColor}`}>
                            <DayIcon className="h-3 w-3" />
                            {item.dias_em_atraso} DIAS DE ATRASO
                          </span>

                          {contexto && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-[10px] font-medium text-slate-400 truncate max-w-[140px]">
                                {contexto}
                              </span>
                            </>
                          )}

                          {item.tendencia && (
                            <>
                              <span className="text-slate-200">·</span>
                              {item.tendencia === "piorando" && <ArrowUp className="h-3 w-3 text-klasse-gold-700" title="Piorando" />}
                              {item.tendencia === "estavel" && <Minus className="h-3 w-3 text-slate-400" title="Estável" />}
                              {item.tendencia === "melhorando" && <ArrowDown className="h-3 w-3 text-klasse-green" title="Melhorando" />}
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedItemId((current) => current === item.aluno_id ? null : item.aluno_id)}
                      className="flex shrink-0 flex-col rounded-lg pl-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klasse-green focus-visible:ring-offset-2 sm:items-end sm:pl-0"
                      aria-label={`Ver detalhes da dívida de ${nome}`}
                      aria-expanded={expandedItemId === item.aluno_id}
                    >
                      <p className="text-sm font-black text-red-600">
                        {moeda.format(Number(item.valor_em_atraso ?? 0))}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {item.titulos_em_atraso
                          ? `${item.titulos_em_atraso} título${item.titulos_em_atraso > 1 ? "s" : ""} em atraso`
                          : "Dívida Total"}
                      </p>
                      {item.ultimo_pagamento_data && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          Último pagto {formatRelativeTime(item.ultimo_pagamento_data)}
                        </p>
                      )}
                    </button>

                    {expandedItemId === item.aluno_id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="basis-full ml-12 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:basis-full sm:ml-12"
                      >
                        <div><span className="text-slate-400">Dias em atraso</span><p className="font-bold text-slate-700">{item.dias_em_atraso}</p></div>
                        <div><span className="text-slate-400">Títulos em atraso</span><p className="font-bold text-slate-700">{item.titulos_em_atraso ?? "—"}</p></div>
                        <div className="col-span-2"><span className="text-slate-400">Último pagamento</span><p className="font-bold text-slate-700">{item.ultimo_pagamento_data ? formatRelativeTime(item.ultimo_pagamento_data) : "Nenhum pagamento registado"}</p></div>
                      </motion.div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </AnimatePresence>
        )}
      </div>

      {/* ── Footer — Data freshness §6 ──────────────────────────────────── */}
      {(lastUpdated || totalAlunos > 5) && (
        <div className="bg-slate-50/50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
          {lastUpdated ? (
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <RefreshCw className="h-3 w-3" />
              <span>Última atualização: {formatFreshness(lastUpdated)}</span>
            </div>
          ) : <div />}

          {totalAlunos > 5 && (
            <Link
              href={contextualLinkHref}
              className="font-bold text-slate-500 hover:text-klasse-green transition-colors flex items-center gap-1 group"
            >
              Ver todos os {totalAlunos} casos
              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
