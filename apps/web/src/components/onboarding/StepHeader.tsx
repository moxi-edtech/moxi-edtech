type Props = {
  step: number;
  totalSteps: number;
};

export function StepHeader({ step, totalSteps }: Props) {
  const pct = (step / totalSteps) * 100;

  const labels: Record<number, string> = {
    1: "Identidade & Operação",
    2: "Estrutura Académica",
  };

  const desc: Record<number, string> = {
    1: "Confirme a identidade da escola e o contexto temporal.",
    2: "Configure cursos, classes, turmas e disciplinas (wizard inteligente).",
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
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step >= 1
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            1
          </div>
        </div>
        <div
          className={`w-14 h-0.5 rounded-full ${
            step > 1 ? "bg-teal-500" : "bg-slate-200"
          }`}
        />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step >= 2
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            2
          </div>
        </div>
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
