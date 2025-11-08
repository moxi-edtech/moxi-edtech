"use client";

import {
  UserGroupIcon,
  AcademicCapIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

export type KpiStats = {
  turmas: number;
  alunos: number;
  professores: number;
  avaliacoes: number;
};

export default function KpiSection({ stats, loading, error }: { stats: KpiStats; loading?: boolean; error?: string | null }) {
  const kpis = [
    {
      title: "Turmas",
      value: loading ? "—" : String(stats.turmas ?? 0),
      icon: UserGroupIcon,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
      iconColor: "text-emerald-600",
    },
    {
      title: "Alunos",
      value: loading ? "—" : String(stats.alunos ?? 0),
      icon: AcademicCapIcon,
      bg: "bg-blue-50",
      color: "text-blue-600",
      iconColor: "text-blue-600",
    },
    {
      title: "Professores",
      value: loading ? "—" : String(stats.professores ?? 0),
      icon: UsersIcon,
      bg: "bg-orange-50",
      color: "text-orange-600",
      iconColor: "text-orange-600",
    },
    {
      title: "Provas / Notas",
      value: loading ? "—" : String(stats.avaliacoes ?? 0),
      icon: ClipboardDocumentListIcon,
      bg: "bg-purple-50",
      color: "text-purple-600",
      iconColor: "text-purple-600",
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
        {kpis.map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="text-sm text-gray-500 mb-2">{item.title}</div>
            <div className="text-3xl font-semibold text-gray-800">{item.value}</div>
            <div
              className={`${item.bg} w-12 h-12 rounded-lg flex items-center justify-center mt-4`}
            >
              <item.icon className={`w-6 h-6 ${item.iconColor}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
