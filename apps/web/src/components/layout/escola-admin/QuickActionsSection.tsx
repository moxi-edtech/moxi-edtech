"use client";

import { usePathname } from "next/navigation";
import { UserPlus, Users, FileText, Megaphone, Calendar, PlusCircle } from "lucide-react";

export default function QuickActionsSection() {
  const pathname = usePathname();
  const escolaId = pathname?.split('/')[2];

  const actions = [
    { label: "Novo Funcionário", icon: UserPlus, href: `/escola/${escolaId}/funcionarios/novo` },
    { label: "Novo Professor", icon: Users, href: "#" }, // Link placeholder
    { label: "Lançar Nota", icon: FileText, href: "#" },
    { label: "Criar Aviso", icon: Megaphone, href: "#" },
    { label: "Agendar Evento", icon: Calendar, href: "#" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          <PlusCircle className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Ações Rápidas</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => action.href && (window.location.href = action.href)}
            className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-slate-50 py-6 px-2 transition-all hover:border-teal-200 hover:bg-white hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:text-teal-600 group-hover:ring-teal-100">
              <action.icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}