// apps/web/src/components/layout/escola-admin/AcademicSection.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Settings, TrendingUp, CreditCard, Users, BookOpen, Lock, Layers } from "lucide-react";
import type { SetupStatus } from "./setupStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  title:       string;
  description: string;
  icon:        React.ElementType;
  href:        string;
  locked?:     boolean;
  reason?:     string; // why it's locked
  badge?:      string;
};

// ─── Item card ────────────────────────────────────────────────────────────────
// Locked items render as <div> — no <Link> — so navigation is truly blocked.

function AcademicItem({ item }: { item: Item }) {
  const Icon = item.icon;

  const inner = (
    <div className={`
      group relative flex items-start gap-3 rounded-xl border p-3 transition-all
      ${item.locked
        ? "border-slate-100 bg-slate-50/50 cursor-not-allowed"
        : "border-slate-100 bg-white hover:border-[#1F6B3B]/25 hover:bg-slate-50 hover:shadow-sm cursor-pointer"
      }
    `}>
      {/* Icon */}
      <div className={`
        flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors
        ${item.locked
          ? "bg-slate-100 text-slate-300"
          : "bg-slate-100 text-slate-600 group-hover:bg-[#1F6B3B]/10 group-hover:text-[#1F6B3B]"
        }
      `}>
        {item.locked ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold truncate ${item.locked ? "text-slate-400" : "text-slate-900"}`}>
          {item.title}
        </p>
        <p className="text-xs text-slate-400 truncate">{item.description}</p>

        {/* Badge (e.g. "Preços pendentes") */}
        {item.badge && !item.locked && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {item.badge}
          </span>
        )}
      </div>

      {/* Reason tooltip — visible on hover when locked */}
      {item.locked && item.reason && (
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 z-10
          bg-slate-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 text-center
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150
          shadow-lg
        ">
          {item.reason}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );

  if (item.locked) return <div>{inner}</div>;

  return (
    <Link href={item.href} className="block">
      {inner}
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AcademicSection({
  escolaId,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
}: {
  escolaId:            string;
  setupStatus:         SetupStatus;
  missingPricingCount?: number;
  financeiroHref?:     string;
}) {
  const { avaliacaoFrequenciaOk, turmasOk } = setupStatus;

  const canFinanceiro = turmasOk;
  const canPromocao   = avaliacaoFrequenciaOk && turmasOk;

  // Scoped fallback — mirrors the fix applied in Data and Content
  const pagamentosHref = financeiroHref ?? `/escola/${escolaId}/financeiro`;

  const items: Item[] = [
    {
      title:       "Configurações Acadêmicas",
      description: "Disciplinas, calendário e regras",
      icon:        Settings,
      href:        `/escola/${escolaId}/admin/configuracoes-academicas`,
    },
    {
      title:       "Funcionários",
      description: "Equipe, acessos e permissões",
      icon:        Users,
      href:        `/escola/${escolaId}/admin/funcionarios`,
    },
    {
      title:       "Pagamentos",
      description: "Gestão financeira e cobranças",
      icon:        CreditCard,
      href:        pagamentosHref,
      locked:      !canFinanceiro,
      reason:      "Crie turmas para activar o módulo financeiro.",
      badge:       missingPricingCount > 0 ? "Preços pendentes" : undefined,
    },
    {
      title:       "Promoção",
      description: "Progressão de alunos",
      icon:        TrendingUp,
      href:        `/escola/${escolaId}/admin/promocao`,
      locked:      !canPromocao,
      reason:      !avaliacaoFrequenciaOk
        ? "Configure avaliação e frequência primeiro."
        : "Crie turmas antes de gerir promoções.",
    },
    {
      title:       "Biblioteca",
      description: "Acervo e empréstimos",
      icon:        BookOpen,
      href:        `/escola/${escolaId}/admin/biblioteca`,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-500 flex-shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Gestão Académica</h3>
            <p className="text-xs text-slate-400 truncate">Módulos principais</p>
          </div>
        </div>

        <Link
          href={`/escola/${escolaId}/admin`}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B3B] hover:underline"
        >
          Ver tudo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-2">
        {items.map((item) => (
          <AcademicItem key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}