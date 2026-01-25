type Props = {
  step: number;
  totalSteps: number;
};

export function StepHeader({ step, totalSteps }: Props) {
  const pct = (step / totalSteps) * 100;

  const labels: Record<number, string> = {
    1: "Ano Letivo & Períodos",
    2: "Frequência & Avaliação",
    3: "Presets Curriculares",
    4: "Gerar Turmas",
  };

  const desc: Record<number, string> = {
    1: "Defina o ano letivo e os trimestres.",
    2: "Escolha o modelo de frequência e avaliação.",
    3: "Aplique presets para o currículo anual.",
    4: "Gere turmas a partir do currículo publicado.",
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-900/20 text-xs font-bold">
          MN
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Onboarding Académico
          </p>
          <h1 className="text-sm font-bold text-slate-900">
            {labels[step] ?? "Passo"}
          </h1>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 flex-1 justify-center">
        {Array.from({ length: totalSteps }, (_, index) => {
          const value = index + 1;
          const active = step >= value;
          return (
            <div key={value} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  active
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {value}
              </div>
              {value < totalSteps && (
                <div
                  className={`w-10 h-0.5 rounded-full ${
                    step > value ? "bg-teal-500" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-40">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">
          Passo {step} de {totalSteps}
        </p>
        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 text-right line-clamp-1">
          {desc[step]}
        </p>
      </div>
    </header>
  );
}
