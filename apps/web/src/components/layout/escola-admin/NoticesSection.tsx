"use client";

import Link from "next/link";
import { Megaphone, ArrowRight, Wallet, GraduationCap, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import type { Aviso } from "./dashboard.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  escolaId?: string;
  notices?: Aviso[];
  portalBase?: "admin" | "operacoes";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string into a relative time string.
 * "agora", "há 5min", "há 2h", "há 3d", or "25 dez"
 */
function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay < 7) return `há ${diffDay}d`;

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}

// ─── Tipo visual configuration ────────────────────────────────────────────────

const TIPO_CONFIG: Record<string, {
  borderColor: string;
  bgContainer: string;
  iconColor: string;
  iconBg: string;
  Icon: typeof Megaphone;
  pulse?: boolean;
}> = {
  urgente: {
    borderColor: "border-l-rose-600",
    bgContainer: "bg-rose-50",
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
    Icon: Megaphone,
    pulse: true,
  },
  financeiro: {
    borderColor: "border-l-klasse-gold",
    bgContainer: "bg-white",
    iconColor: "text-klasse-gold",
    iconBg: "bg-klasse-gold/10",
    Icon: Wallet,
  },
  academico: {
    borderColor: "border-l-blue-500",
    bgContainer: "bg-white",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    Icon: GraduationCap,
  },
  sistema: {
    borderColor: "border-l-slate-400",
    bgContainer: "bg-white",
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100",
    Icon: Settings,
  },
  geral: {
    borderColor: "border-l-indigo-500",
    bgContainer: "bg-white",
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    Icon: Megaphone,
  },
};

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NoticesSection — Avisos recentes com princípios de Graciosidade.
 *
 * Exibe avisos com categorização visual por tipo, prioridade,
 * indicador de não-lidos, CTAs contextuais e empty state orientador.
 */
export default function NoticesSection({ escolaId, notices = [], portalBase = "admin" }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const hrefAll = escolaParam ? buildPortalHref(escolaParam, `/${portalBase}/avisos`) : "#";
  const hrefNew = escolaParam ? buildPortalHref(escolaParam, `/${portalBase}/avisos/novo`) : "#";

  const isOperacoes = portalBase === "operacoes";

  // Count unread notices for the badge
  const unreadCount = notices.filter((n) => n.lido === false).length;

  // Sort: urgent/high-priority first, then by date descending
  const sortedNotices = [...notices].sort((a, b) => {
    const aPriority = a.prioridade === "alta" || a.tipo === "urgente" ? 1 : 0;
    const bPriority = b.prioridade === "alta" || b.tipo === "urgente" ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return new Date(b.dataISO).getTime() - new Date(a.dataISO).getTime();
  });

  return (
    <section
      className={`border border-slate-200 bg-white p-6 ${
        isOperacoes ? "rounded-lg shadow-none" : "rounded-2xl shadow-sm"
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`bg-indigo-50 p-2 text-indigo-600 ${
              isOperacoes ? "rounded-lg" : "rounded-xl"
            }`}
          >
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold text-slate-900">Avisos recentes</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  {unreadCount} {unreadCount === 1 ? "novo" : "novos"}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">Comunicados e mensagens</p>
          </div>
        </div>

        <Link
          href={hrefAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-klasse-green-500 hover:bg-klasse-green-50 transition-colors"
        >
          Ver tudo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {notices.length === 0 ? (
        /* Gracioso empty state — §2 cada bloqueio apresenta o próximo passo */
        <div
          className={`flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center ${
            isOperacoes ? "rounded-lg" : "rounded-xl"
          }`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Megaphone className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900">Sem avisos por enquanto</h4>
          <p className="mx-auto mt-1 max-w-[220px] text-xs text-slate-500">
            Quando houver comunicados, eles aparecem aqui.
          </p>
          {portalBase === "admin" && (
            <Link
              href={hrefNew}
              className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-klasse-green hover:text-klasse-green/80 transition-colors"
            >
              Criar comunicado <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : (
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2.5"
        >
          <AnimatePresence>
            {sortedNotices.slice(0, 5).map((n) => {
              const tipoKey = n.tipo || "geral";
              const config = TIPO_CONFIG[tipoKey] || TIPO_CONFIG.geral;
              const isUrgente = tipoKey === "urgente";
              const date = formatRelativeTime(n.dataISO);
              const { Icon } = config;

              // Unread items get subtle visual distinction
              const unreadBg = n.lido ? "bg-slate-50/50" : "bg-white shadow-sm";
              const baseBg = isUrgente ? config.bgContainer : unreadBg;

              return (
                <motion.li
                  key={n.id}
                  variants={itemVariants}
                  className={`group relative flex min-h-[56px] flex-col justify-center gap-2 overflow-hidden border-l-4 border-y border-r border-y-slate-100 border-r-slate-100 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${baseBg} ${
                    config.borderColor
                  } ${isOperacoes ? "rounded-lg" : "rounded-xl"}`}
                >
                  {/* Icon + Content */}
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.iconBg} ${config.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                      {config.pulse && !n.lido && (
                        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-bold ${
                          !n.lido ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {n.titulo}
                      </p>
                      {n.resumo && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                          {n.resumo}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                        {n.autor && <span>{n.autor} &bull;</span>}
                        <span>{date}</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA button — §2 Próximo Passo */}
                  {n.action_label && n.action_href && (
                    <div className="mt-2 shrink-0 sm:mt-0">
                      <Link
                        href={n.action_href}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-klasse-green/20 px-3 py-1.5 text-xs font-bold text-klasse-green hover:bg-klasse-green/5 transition-colors sm:w-auto"
                      >
                        {n.action_label}
                      </Link>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}
