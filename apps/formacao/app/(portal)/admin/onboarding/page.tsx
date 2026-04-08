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
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", opacity: 0.65 }}>
          Onboarding Formação
        </p>
        <h1 style={{ margin: "6px 0" }}>Setup Inicial do Centro</h1>
        <p style={{ margin: 0, opacity: 0.78 }}>
          Fluxo exclusivo de Formação, separado do onboarding K12.
        </p>
      </header>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <span>Progresso</span>
          <strong>{progress.completed}/{progress.total} ({progress.percent}%)</strong>
        </div>
        <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999 }}>
          <div
            style={{
              width: `${progress.percent}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg,#16a34a,#0ea5e9)",
            }}
          />
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {STEPS.map((step, index) => {
          const active = currentStep === index + 1;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => setCurrentStep(index + 1)}
              style={{
                textAlign: "left",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 12px",
                background: active ? "#ecfeff" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>{index + 1}. {step.title}</strong>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{done[step.key] ? "Concluído" : "Pendente"}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.75 }}>{step.hint}</p>
            </button>
          );
        })}
      </section>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>{activeStep.title}</h2>
        <p style={{ marginTop: 0, opacity: 0.78 }}>{activeStep.hint}</p>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setDone((prev) => ({ ...prev, [activeStep.key]: !prev[activeStep.key] }))}
            style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", background: "#fff" }}
          >
            {done[activeStep.key] ? "Marcar pendente" : "Marcar concluído"}
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.min(STEPS.length, prev + 1))}
            style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", background: "#fff" }}
          >
            Próximo passo
          </button>
        </div>
      </section>
    </div>
  );
}
