// apps/web/src/components/layout/escola-admin/AcademicSection.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Settings, TrendingUp, CreditCard, Users, BookOpen, Lock } from "lucide-react";
import type { SetupStatus } from "./setupStatus";

type Item = {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  locked?: boolean;
  badge?: string;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AcademicSection({
  escolaId,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
}: {
  escolaId: string;
  setupStatus: SetupStatus;
  missingPricingCount?: number;
  financeiroHref?: string;
}) {
  const { avaliacaoFrequenciaOk, turmasOk } = setupStatus;
  const canFinanceiro = turmasOk;
  const canPromocao = avaliacaoFrequenciaOk && turmasOk;
  const pagamentosHref = financeiroHref ?? `/escola/${escolaId}/financeiro`;
  const items: Item[] = [
    {
      title: "Configurações Acadêmicas",
      description: "Disciplinas, calendário e regras",
      icon: Settings,
      href: `/escola/${escolaId}/admin/configuracoes-academicas`,
      locked: false,
    },
    {
      title: "Funcionários",
      description: "Equipe, acessos e permissões",
      icon: Users,
      href: `/escola/${escolaId}/admin/funcionarios`,
      locked: false,
    },
    {
      title: "Pagamentos",
      description: "Gestão financeira e cobranças",
      icon: CreditCard,
      href: pagamentosHref,
      locked: !canFinanceiro,
      badge: missingPricingCount > 0 ? "Preços pendentes" : undefined,
    },
    {
      title: "Promoção",
      description: "Progressão de alunos",
      icon: TrendingUp,
      href: `/escola/${escolaId}/admin/promocao`,
      locked: !canPromocao,
    },
    {
      title: "Biblioteca",
      description: "Acervo e empréstimos",
      icon: BookOpen,
      href: `/escola/${escolaId}/admin/biblioteca`,
      locked: false,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">Gestão Acadêmica</h3>
          {/* ✅ 1 linha */}
          <p className="text-sm text-slate-500 truncate">Configure e opere os módulos principais</p>
        </div>

        <Link
          href={`/escola/${escolaId}/admin`}
          className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          Ver tudo <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => {
          const Icon = it.icon;

          return (
            <Link
              key={it.href}
              href={it.href}
              aria-disabled={it.locked}
              className={cn(
                "group rounded-xl border border-slate-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50",
                it.locked && "opacity-60 grayscale pointer-events-none"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  {it.locked ? <Lock className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  {/* ✅ 1 linha */}
                  <div className="text-sm font-bold text-slate-900 truncate">{it.title}</div>
                  {/* ✅ 1 linha */}
                  <div className="text-xs text-slate-500 truncate">{it.description}</div>

                  {it.badge && (
                    <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {it.badge}
                    </div>
                  )}
                  {it.locked && (
                    <div className="mt-1 text-[10px] font-bold text-slate-500">Bloqueado</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
