// apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx
"use client";

import Link from "next/link";
import { PlusCircle, UserPlus, Users, FileText, Megaphone, Calendar, Lock } from "lucide-react";
import type { SetupStatus } from "./setupStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAction = {
  label:    string;
  href:     string;
  icon:     React.ElementType;
  disabled?: boolean;
  reason?:  string; // shown when disabled — explains *why*, not just "Bloqueado"
};

// ─── Action card ──────────────────────────────────────────────────────────────
// Disabled actions render as a plain div (no <Link>) to prevent navigation
// via keyboard, middle-click, or direct URL access.

function ActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  const inner = (
    <div className="relative group flex flex-col items-center justify-center gap-2.5 rounded-xl border px-2 py-5 transition-all bg-slate-50 border-slate-100 hover:bg-white hover:border-[#1F6B3B]/30 hover:shadow-md">
      {/* Icon circle */}
      <div className={`
        flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 transition-all
        ${action.disabled
          ? "bg-slate-100 text-slate-300 ring-slate-200"
          : "bg-white text-slate-500 ring-slate-200 group-hover:text-[#1F6B3B] group-hover:ring-[#1F6B3B]/20"
        }
      `}>
        {action.disabled ? <Lock className="h-4 w-4" /> : <Icon className="h-5 w-5" />}
      </div>

      {/* Label */}
      <span className={`
        w-full text-center text-xs font-semibold leading-tight line-clamp-2
        ${action.disabled ? "text-slate-400" : "text-slate-700"}
      `}>
        {action.label}
      </span>

      {/* Reason tooltip on hover — visible only when disabled */}
      {action.disabled && action.reason && (
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 z-10
          bg-slate-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 text-center
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150
          shadow-lg
        ">
          {action.reason}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );

  if (action.disabled) {
    return <div className="cursor-not-allowed">{inner}</div>;
  }

  return (
    <Link href={action.href} className="block">
      {inner}
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickActionsSection({
  escolaId,
  setupStatus,
}: {
  escolaId:    string;
  setupStatus: SetupStatus;
}) {
  const { anoLetivoOk, avaliacaoFrequenciaOk, turmasOk } = setupStatus;

  const canCreateProfessor = anoLetivoOk;
  const canLaunchNota      = avaliacaoFrequenciaOk && turmasOk;

  const actions: QuickAction[] = [
    {
      label: "Novo Funcionário",
      icon:  UserPlus,
      href:  `/escola/${escolaId}/admin/funcionarios/novo`,
    },
    {
      label:    "Novo Professor",
      icon:     Users,
      href:     `/escola/${escolaId}/professores?tab=adicionar`,
      disabled: !canCreateProfessor,
      reason:   "Configure o ano letivo antes de adicionar professores.",
    },
    {
      label:    "Lançar Nota",
      icon:     FileText,
      href:     `/escola/${escolaId}/admin/notas`,
      disabled: !canLaunchNota,
      reason:   !avaliacaoFrequenciaOk
        ? "Configure avaliação e frequência primeiro."
        : "Crie turmas antes de lançar notas.",
    },
    {
      label: "Criar Aviso",
      icon:  Megaphone,
      href:  `/escola/${escolaId}/admin/avisos/novo`,
    },
    {
      label: "Agendar Evento",
      icon:  Calendar,
      href:  `/escola/${escolaId}/admin/calendario/novo`,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-5 flex items-center gap-2.5">
        <div className="rounded-xl bg-slate-100 p-2 text-slate-500">
          <PlusCircle className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Ações Rápidas</h3>
      </header>

      {/* 
        5 items: 2 cols on mobile → 3 on sm → 5 on lg.
        sm:grid-cols-3 leaves an orphan on small screens intentionally —
        the 2-col fallback on xs avoids it entirely.
      */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <ActionCard key={action.href} action={action} />
        ))}
      </div>
    </section>
  );
}
