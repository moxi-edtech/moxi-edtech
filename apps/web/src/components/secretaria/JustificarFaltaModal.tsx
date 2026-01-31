"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarCheck } from "lucide-react";

type TurmaItem = {
  id: string;
  turma_nome?: string | null;
  nome?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function JustificarFaltaModal() {
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ ano: String(anoLetivo) });
        const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setTurmas(json.items || json.data || []);
        } else {
          setTurmas([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [anoLetivo]);

  const turmaSelecionada = useMemo(
    () => turmas.find((t) => t.id === turmaId) ?? null,
    [turmas, turmaId]
  );

  const turmaLabel = turmaSelecionada
    ? turmaSelecionada.turma_nome || turmaSelecionada.nome || "Turma"
    : "Turma";

  const handleAbrirTurma = () => {
    if (!turmaId) return;
    window.location.href = `/secretaria/turmas/${turmaId}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        A justificativa de faltas é registrada na turma dentro do painel acadêmico.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Ano letivo</label>
          <input
            type="number"
            value={anoLetivo}
            onChange={(event) => setAnoLetivo(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Turma</label>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={turmaId}
              onChange={(event) => setTurmaId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione a turma</option>
              {turmas.map((turma) => {
                const label = turma.turma_nome || turma.nome || "Turma";
                const meta = [turma.classe_nome, turma.turno].filter(Boolean).join(" • ");
                return (
                  <option key={turma.id} value={turma.id}>
                    {meta ? `${label} (${meta})` : label}
                  </option>
                );
              })}
            </select>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAbrirTurma}
        disabled={!turmaId}
        className={cx(
          "flex w-full items-center justify-center gap-2 rounded-lg bg-klasse-gold px-3 py-2 text-sm font-semibold text-white",
          !turmaId && "opacity-50"
        )}
      >
        <CalendarCheck className="h-4 w-4" />
        Abrir turma {turmaLabel}
      </button>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/secretaria/calendario";
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        Ver calendário de faltas
      </button>
    </div>
  );
}
