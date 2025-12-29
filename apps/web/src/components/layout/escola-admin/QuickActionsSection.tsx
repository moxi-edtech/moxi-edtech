// apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx
"use client";

import Link from "next/link";
import { PlusCircle, UserPlus, Users, FileText, Megaphone, Calendar } from "lucide-react";

type QuickAction = {
  label: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: string; // ex: "Bloqueado"
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function QuickActionsSection({ escolaId }: { escolaId: string }) {
  const actions: QuickAction[] = [
    {
      label: "Novo Funcionário",
      icon: UserPlus,
      href: `/escola/${escolaId}/admin/funcionarios/novo`,
      disabled: false,
    },
    {
      label: "Novo Professor",
      icon: Users,
      href: `/escola/${escolaId}/admin/professores/novo`,
      disabled: true,
      badge: "Bloqueado",
    },
    {
      label: "Lançar Nota",
      icon: FileText,
      href: `/escola/${escolaId}/admin/avaliacoes`,
      disabled: true,
      badge: "Bloqueado",
    },
    {
      label: "Criar Aviso",
      icon: Megaphone,
      href: `/escola/${escolaId}/admin/avisos/novo`,
      disabled: true,
      badge: "Bloqueado",
    },
    {
      label: "Agendar Evento",
      icon: Calendar,
      href: `/escola/${escolaId}/admin/calendario/novo`,
      disabled: true,
      badge: "Bloqueado",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-6 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          <PlusCircle className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Ações Rápidas</h3>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {actions.map((a) => {
          const Icon = a.icon;

          const Card = (
            <div
              className={cn(
                "group relative flex flex-col items-center justify-center gap-3 rounded-xl border bg-slate-50 px-2 py-6 transition-all",
                "border-slate-100 hover:border-teal-200 hover:bg-white hover:shadow-md",
                a.disabled && "opacity-60 grayscale pointer-events-none"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:text-teal-600 group-hover:ring-teal-100">
                <Icon className="h-6 w-6" />
              </div>

              {/* ✅ 1 linha */}
              <span className="w-full text-center text-sm font-semibold text-slate-700 truncate">
                {a.label}
              </span>

              {a.badge && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {a.badge}
                </span>
              )}
            </div>
          );

          return (
            <Link key={a.href} href={a.href} aria-disabled={a.disabled}>
              {Card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}