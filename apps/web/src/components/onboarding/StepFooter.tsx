type Props = {
  step: number;
  totalSteps: number;
  canProceed?: boolean;
  onNext: () => void;
  onBack: () => void;
  loading?: boolean;
};

export function StepFooter({
  step,
  totalSteps,
  canProceed = true,
  onNext,
  onBack,
  loading = false,
}: Props) {
  const isLast = step === totalSteps;

  const label = (() => {
    if (isLast && loading) return "Finalizando...";
    if (isLast) return "Concluir Setup";
    return "Continuar";
  })();

  return (
    <footer className="sticky bottom-0 left-0 w-full bg-white/90 backdrop-blur border-t border-slate-200 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-2 sm:px-0">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 1 || loading}
          className="text-slate-400 hover:text-slate-900 font-medium text-sm flex items-center gap-2 px-4 py-2 disabled:opacity-0 disabled:cursor-default transition"
        >
          <span className="text-xs">←</span> Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || loading}
          className={`text-sm font-bold px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all ${
            isLast
              ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20"
              : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {loading && (
            <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
          )}
          {label}
          {!loading && <span className="text-xs">→</span>}
        </button>
      </div>
    </footer>
  );
}
