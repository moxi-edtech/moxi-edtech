"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Loader2 } from "lucide-react";

type TurmaItem = {
  id: string;
  turma_nome?: string | null;
  nome?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
};

type DisciplinaItem = {
  id: string;
  disciplina?: { id?: string | null; nome?: string | null } | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function PautaRapidaModal() {
  const router = useRouter();
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingTurmas(true);
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
        if (active) setLoadingTurmas(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [anoLetivo]);

  useEffect(() => {
    if (!turmaId) {
      setDisciplinas([]);
      setDisciplinaId("");
      return;
    }

    let active = true;
    const load = async () => {
      setLoadingDisciplinas(true);
      try {
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setDisciplinas(json.items || []);
        } else {
          setDisciplinas([]);
        }
      } finally {
        if (active) setLoadingDisciplinas(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [turmaId]);

  const turmaSelecionada = useMemo(
    () => turmas.find((t) => t.id === turmaId) ?? null,
    [turmas, turmaId]
  );

  const disciplinaSelecionada = useMemo(
    () => disciplinas.find((d) => d.disciplina?.id === disciplinaId) ?? null,
    [disciplinas, disciplinaId]
  );

  const turmaLabel = turmaSelecionada
    ? turmaSelecionada.turma_nome || turmaSelecionada.nome || "Turma"
    : "Turma";

  const handleOpen = (path: string) => {
    if (!turmaId) return;
    window.location.href = path;
  };

  return (
    <div className="space-y-4">
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
            {loadingTurmas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Disciplina</label>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={disciplinaId}
            onChange={(event) => setDisciplinaId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            disabled={!turmaId}
          >
            <option value="">Selecione a disciplina</option>
            {disciplinas.map((disciplina) => (
              <option key={disciplina.id} value={disciplina.disciplina?.id ?? ""}>
                {disciplina.disciplina?.nome ?? "Disciplina"}
              </option>
            ))}
          </select>
          {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleOpen(`/api/secretaria/turmas/${turmaId}/pauta`)}
          disabled={!turmaId}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Pauta digital (Excel)
        </button>
        <button
          type="button"
          onClick={() => handleOpen(`/api/secretaria/turmas/${turmaId}/pauta-branca`)}
          disabled={!turmaId}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <LayoutDashboard className="h-4 w-4" />
          Pauta em branco
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleOpen(`/api/secretaria/turmas/${turmaId}/mini-pautas`)}
          disabled={!turmaId}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Mini-pautas
        </button>
        <button
          type="button"
          onClick={() => turmaId && router.push(`/secretaria/turmas/${turmaId}`)}
          disabled={!turmaId}
          className="flex items-center justify-center gap-2 rounded-lg bg-klasse-gold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Gerenciar notas da {turmaLabel}
        </button>
      </div>

      {disciplinaSelecionada ? (
        <p className="text-xs text-slate-500">
          Disciplina selecionada: {disciplinaSelecionada.disciplina?.nome ?? "—"}
        </p>
      ) : null}
    </div>
  );
}
