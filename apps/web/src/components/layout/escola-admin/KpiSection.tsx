"use client";

import {
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

export interface EscolaAdminStats {
  turmas?: number | null;
  professores?: number | null;
  disciplinas?: number | null;
  alunos?: number | null;
  planosDeAulaPublicados?: number | null;
}

interface KpiSectionProps {
  loading?: boolean;
  stats?: EscolaAdminStats | null;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");

const toSafeNumber = (value: number | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
};

const resolveStats = (stats?: EscolaAdminStats | null) => ({
  turmas: toSafeNumber(stats?.turmas),
  professores: toSafeNumber(stats?.professores),
  disciplinas: toSafeNumber(stats?.disciplinas),
  alunos: toSafeNumber(stats?.alunos),
  planosDeAulaPublicados: toSafeNumber(stats?.planosDeAulaPublicados),
});

export default function KpiSection({ loading = false, stats }: KpiSectionProps) {
  const safeStats = resolveStats(stats);

  const cards = [
    {
      title: "Turmas",
      value: safeStats.turmas,
      icon: UserGroupIcon,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
      caption: "Turmas criadas para o ano letivo em curso",
    },
    {
      title: "Professores",
      value: safeStats.professores,
      icon: AcademicCapIcon,
      bg: "bg-sky-50",
      color: "text-sky-600",
      caption: "Docentes associados às turmas",
    },
    {
      title: "Disciplinas",
      value: safeStats.disciplinas,
      icon: ClipboardDocumentCheckIcon,
      bg: "bg-violet-50",
      color: "text-violet-600",
      caption: "Componentes curriculares habilitados",
    },
    {
      title: "Alunos",
      value: safeStats.alunos,
      icon: UsersIcon,
      bg: "bg-amber-50",
      color: "text-amber-600",
      caption: "Matrículas ativas nas turmas",
    },
  ];

  return (
    <section aria-label="Indicadores rápidos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, icon: Icon, bg, color, caption }) => {
        const displayValue = loading ? "—" : NUMBER_FORMATTER.format(value);
        const iconBg = `${color.replace("text-", "bg-")}/10`;

        return (
          <article
            key={title}
            className={`${bg} rounded-2xl border border-black/5 p-6 shadow-sm transition hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-500">{title}</h3>
                <p className={`mt-2 text-3xl font-semibold ${color}`}>{displayValue}</p>
              </div>
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`h-6 w-6 ${color}`} aria-hidden />
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">{caption}</p>
          </article>
        );
      })}
    </section>
  );
}
