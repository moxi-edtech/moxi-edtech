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
    <header className="bg-card/90 backdrop-blur-md border border-border rounded-xl px-6 py-4 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-klasse-green rounded-lg flex items-center justify-center text-white shadow-lg shadow-klasse-dark/20 text-xs font-bold">
          MN
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Onboarding Académico
          </p>
          <h1 className="text-sm font-bold text-foreground">
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
                    ? "bg-klasse-green text-white shadow-md"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {value}
              </div>
              {value < totalSteps && (
                <div
                  className={`w-10 h-0.5 rounded-full ${
                    step > value ? "bg-klasse-green" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-40">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider text-right">
          Passo {step} de {totalSteps}
        </p>
        <div className="h-1.5 w-full bg-muted rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-klasse-green transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-right line-clamp-1">
          {desc[step]}
        </p>
      </div>
    </header>
  );
}
