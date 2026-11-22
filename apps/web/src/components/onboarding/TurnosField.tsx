import type { TurnosState } from "@/components/escola/onboarding/academicSetupTypes";

type Props = {
  turnos: TurnosState;
  setTurnos: (t: TurnosState) => void;
};

export function TurnosField({ turnos, setTurnos }: Props) {
  function toggle(key: keyof TurnosState) {
    setTurnos({ ...turnos, [key]: !turnos[key] });
  }

  const chips: { key: keyof TurnosState; label: string }[] = [
    { key: "Manhã", label: "Manhã" },
    { key: "Tarde", label: "Tarde" },
    { key: "Noite", label: "Noite" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-3 block tracking-wide">
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
                  ? "bg-klasse-green/10 border-klasse-green text-klasse-green dark:text-klasse-green-300 shadow-sm ring-1 ring-klasse-green"
                  : "bg-card border-border text-muted-foreground hover:border-ring"
              }`}
            >
              {active ? (
                <span className="inline-block w-3 h-3 rounded-full bg-klasse-green" />
              ) : (
                <span className="inline-block w-3 h-3 rounded-full bg-muted-foreground/20" />
              )}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
