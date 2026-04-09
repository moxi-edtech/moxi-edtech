"use client";

import { useMemo, useState } from "react";

type StepKey =
  | "dados"
  | "cursos"
  | "cohorts"
  | "cronograma"
  | "formadores"
  | "formandos"
  | "b2b_certificados";

const STEPS: Array<{ key: StepKey; title: string; hint: string }> = [
  { key: "dados", title: "Dados Base", hint: "NIPC, MAPTESS, regime fiscal" },
  { key: "cursos", title: "Cursos", hint: "Catálogo e áreas de formação" },
  { key: "cohorts", title: "Cohorts", hint: "Edições, vagas e datas" },
  { key: "cronograma", title: "Cronograma", hint: "Calendário de aulas" },
  { key: "formadores", title: "Formadores", hint: "Equipa docente e honorários" },
  { key: "formandos", title: "Formandos", hint: "Inscrições e turmas" },
  { key: "b2b_certificados", title: "B2B + Certificados", hint: "Clientes empresariais e templates" },
];

export default function FormacaoOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    dados: false,
    cursos: false,
    cohorts: false,
    cronograma: false,
    formadores: false,
    formandos: false,
    b2b_certificados: false,
  });

  const progress = useMemo(() => {
    const total = STEPS.length;
    const completed = STEPS.filter((step) => done[step.key]).length;
    return { total, completed, percent: Math.round((completed / total) * 100) };
  }, [done]);

  const activeStep = STEPS[currentStep - 1];

  return (
    <div className="grid gap-4">
      <header>
        <p className="m-0 text-xs uppercase tracking-wider text-zinc-500">
          Onboarding Formação
        </p>
        <h1 className="my-1.5 text-3xl font-bold text-zinc-900">Setup Inicial do Centro</h1>
        <p className="m-0 text-zinc-600">
          Fluxo exclusivo de Formação, separado do onboarding K12.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 p-3">
        <div className="mb-2 flex items-center justify-between text-sm text-zinc-700">
          <span>Progresso</span>
          <strong>{progress.completed}/{progress.total} ({progress.percent}%)</strong>
        </div>
        <div className="h-2.5 rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-600 to-sky-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </section>

      <section className="grid gap-2">
        {STEPS.map((step, index) => {
          const active = currentStep === index + 1;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => setCurrentStep(index + 1)}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active ? "border-sky-200 bg-sky-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{index + 1}. {step.title}</strong>
                <span className="text-xs text-zinc-500">{done[step.key] ? "Concluído" : "Pendente"}</span>
              </div>
              <p className="mb-0 mt-1.5 text-sm text-zinc-600">{step.hint}</p>
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-zinc-200 p-3.5">
        <h2 className="mt-0 text-xl font-semibold text-zinc-900">{activeStep.title}</h2>
        <p className="mt-0 text-zinc-600">{activeStep.hint}</p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDone((prev) => ({ ...prev, [activeStep.key]: !prev[activeStep.key] }))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {done[activeStep.key] ? "Marcar pendente" : "Marcar concluído"}
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.min(STEPS.length, prev + 1))}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Próximo passo
          </button>
        </div>
      </section>
    </div>
  );
}
