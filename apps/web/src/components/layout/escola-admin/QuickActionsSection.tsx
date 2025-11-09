"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import type { AcaoRapida } from "./definitions";
import {
  PlusIcon,
  UserGroupIcon,
  AcademicCapIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  MegaphoneIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

interface QuickActionsSectionProps {
  acoes?: AcaoRapida[];
  onAcao?: (acaoId: string) => void;
}

export default function QuickActionsSection({
  acoes,
  onAcao,
}: QuickActionsSectionProps) {
  const pathname = usePathname();
  const escolaIdMatch = pathname?.match(/\/escola\/([^/]+)/);
  const escolaId = escolaIdMatch?.[1] ?? "";

  const defaults: AcaoRapida[] = [
    { id: "nova-turma", rotulo: "Nova Turma", icone: UserGroupIcon, iconeExtra: PlusIcon },
    { id: "cadastrar-funcionario", rotulo: "Cadastrar Funcionário", icone: AcademicCapIcon, iconeExtra: PlusIcon, href: escolaId ? `/escola/${escolaId}/funcionarios/novo` : undefined },
    { id: "cadastrar-professor", rotulo: "Cadastrar Professor", icone: UsersIcon, iconeExtra: PlusIcon },
    { id: "lancar-nota", rotulo: "Lançar Nota", icone: ClipboardDocumentListIcon },
    { id: "criar-aviso", rotulo: "Criar Aviso", icone: MegaphoneIcon },
    { id: "agendar-evento", rotulo: "Agendar Evento", icone: CalendarIcon },
  ];

  const lista = acoes?.length ? acoes : defaults;

  const handleClick = useCallback(
    (id: string, href?: string) => {
      if (onAcao) return onAcao(id);
      if (href) window.location.href = href;
      else console.log("[QuickActions] ação:", id);
    },
    [onAcao]
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Ações Rápidas</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {lista.map((a) => {
          const Icon = a.icone;
          const Extra = a.iconeExtra;

          return (
            <button
              key={a.id}
              onClick={() => handleClick(a.id, a.href)}
              className={`group w-full rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-emerald-300 transition p-3 text-center ${a.className ?? ""}`}
              aria-label={a.rotulo}
            >
              <div className="relative flex justify-center items-center mb-2">
                {Extra ? (
                  <div className="relative">
                    <Icon className="w-6 h-6 text-gray-600 group-hover:text-gray-800" />
                    <Extra className="w-3 h-3 text-emerald-500 absolute -top-1 -right-1 bg-white rounded-full" />
                  </div>
                ) : (
                  <Icon className="w-6 h-6 text-gray-600 group-hover:text-gray-800" />
                )}
              </div>
              <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {a.rotulo}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
