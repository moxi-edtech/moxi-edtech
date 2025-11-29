import type { TurnosState } from "@/app/configuracoes/onboarding/AcademicSetupWizard";

type Props = {
  turnos: TurnosState;
  setTurnos: (t: TurnosState) => void;
};

export function TurnosField({ turnos, setTurnos }: Props) {
  function toggle(key: keyof TurnosState) {
    setTurnos({ ...turnos, [key]: !turnos[key] });
  }

  const chips: { key: keyof TurnosState; label: string }[] = [
    { key: "manha", label: "Manhã" },
    { key: "tarde", label: "Tarde" },
    { key: "noite", label: "Noite" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 block tracking-wide">
        Turnos Ativos
      </label>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = turnos[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 ${
                active
                  ? "bg-white border-teal-500 text-teal-700 shadow-sm ring-1 ring-teal-500"
                  : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {active ? (
                <span className="inline-block w-3 h-3 rounded-full bg-teal-500" />
              ) : (
                <span className="inline-block w-3 h-3 rounded-full bg-slate-200" />
              )}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
