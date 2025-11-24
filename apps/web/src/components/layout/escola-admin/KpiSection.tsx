"use client";

import {
  UserGroupIcon,
  AcademicCapIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

export type KpiStats = {
  turmas: number;
  alunos: number;
  professores: number;
  avaliacoes: number;
};

export default function KpiSection({ escolaId, stats, loading, error }: { escolaId?: string; stats: KpiStats; loading?: boolean; error?: string | null }) {
  const alunosHref = escolaId ? `/escola/${escolaId}/admin/alunos` : undefined;
  const turmasHref = escolaId ? `/escola/${escolaId}/admin/turmas` : undefined;
  const professoresHref = escolaId ? `/escola/${escolaId}/admin/professores` : undefined;
  const notasHref = escolaId ? `/escola/${escolaId}/admin/notas` : undefined;
  const kpis = [
    {
      title: "Turmas",
      value: loading ? "—" : String(stats.turmas ?? 0),
      icon: UserGroupIcon,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
      iconColor: "text-emerald-600",
      href: turmasHref,
    },
    {
      title: "Alunos ativos",
      value: loading ? "—" : String(stats.alunos ?? 0),
      icon: AcademicCapIcon,
      bg: "bg-blue-50",
      color: "text-blue-600",
      iconColor: "text-blue-600",
      href: alunosHref,
    },
    {
      title: "Professores",
      value: loading ? "—" : String(stats.professores ?? 0),
      icon: UsersIcon,
      bg: "bg-orange-50",
      color: "text-orange-600",
      iconColor: "text-orange-600",
      href: professoresHref,
    },
    {
      title: "Provas / Notas",
      value: loading ? "—" : String(stats.avaliacoes ?? 0),
      icon: ClipboardDocumentListIcon,
      bg: "bg-purple-50",
      color: "text-purple-600",
      iconColor: "text-purple-600",
      href: notasHref,
    },
  ];

  return (
    <div>
      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}
      {loading && !error && (
        <p className="text-xs text-gray-400 mb-3">Atualizando…</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpis.map((item) => {
          const content = (
            <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
              <div className="text-sm text-gray-500 mb-2">{item.title}</div>
              <div className="text-3xl font-semibold text-gray-800">{item.value}</div>
              <div className={`${item.bg} w-12 h-12 rounded-lg flex items-center justify-center mt-4`}>
                <item.icon className={`w-6 h-6 ${item.iconColor}`} />
              </div>
            </div>
          );
          return item.href ? (
            <Link key={item.title} href={item.href} className="block focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl">
              {content}
            </Link>
          ) : (
            <div key={item.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
