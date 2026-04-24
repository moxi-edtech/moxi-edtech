"use client";

import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { WidgetEmpty, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

interface Escola {
  id: string;
  nome: string;
  plano: string;
  onboarding_finalizado: boolean;
  progresso_onboarding: number;
  alunos_ativos: number;
}

interface Props {
  escolas?: Escola[];
  isLoading?: boolean;
}

export default function SchoolsSection({ escolas, isLoading = false }: Props) {
  if (isLoading) return <WidgetSkeleton lines={4} />;

  const schools = escolas ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Acompanhamento da Rede</h2>
          <p className="mt-1 text-sm text-slate-500">Progresso de integração das escolas.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-klasse-green/10 px-3 py-1 text-sm font-medium text-klasse-green">
          <span className="h-1.5 w-1.5 rounded-full bg-klasse-green" />
          {schools.length} unidades
        </span>
      </div>

      <div className="grid gap-3">
        {schools.length === 0 ? (
          <WidgetEmpty
            title="Sem escolas em onboarding"
            message="Nenhuma escola foi carregada para acompanhamento de ativação."
            nextStep="Verifique sincronização de tenants e execute refresh da lista de escolas."
          />
        ) : (
          schools.map((escola) => (
            <article
              key={escola.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:ring-1 hover:ring-klasse-gold/25 md:flex-row md:items-center"
            >
              <div className="min-w-0 md:w-1/3">
                <h3 className="truncate text-sm font-semibold text-slate-950">{escola.nome}</h3>
                <p className="text-sm text-slate-500">Plano {escola.plano}</p>
              </div>

              <div className="w-full md:max-w-md">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {escola.onboarding_finalizado ? "Tudo pronto para operar" : "Em fase de configuração"}
                  </span>
                  <span className="font-semibold text-slate-950">{escola.progresso_onboarding}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-klasse-green transition-all duration-700"
                    style={{ width: `${escola.progresso_onboarding}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 md:w-1/4 md:justify-end">
                <p className="text-sm text-slate-500">Alunos: {escola.alunos_ativos.toLocaleString()}</p>

                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                    escola.onboarding_finalizado ? "bg-klasse-green/10 text-klasse-green" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {escola.onboarding_finalizado ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                  {escola.onboarding_finalizado ? "Concluído" : "Em curso"}
                </span>

                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:ring-1 hover:ring-klasse-gold/25">
                  Ver escola
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
