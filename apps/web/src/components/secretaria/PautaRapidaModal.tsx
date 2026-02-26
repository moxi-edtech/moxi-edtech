"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOfficialDocs, type MiniPautaPayload, type TrimestreNumero } from "@/hooks/useOfficialDocs";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";

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
  meta?: {
    carga_horaria_semanal?: number | null;
    classificacao?: string | null;
    periodos_ativos?: number[] | null;
    entra_no_horario?: boolean | null;
    avaliacao_mode?: string | null;
  } | null;
  curriculo_status?: string | null;
};

type PeriodoItem = {
  id: string;
  numero: number;
  dt_inicio?: string | null;
  dt_fim?: string | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type PautaRapidaModalProps = {
  initialTurmaId?: string;
  initialPeriodoNumero?: number;
  initialDisciplinaId?: string;
  initialTurmaLabel?: string;
  lockTurma?: boolean;
  showPeriodoTabs?: boolean;
  pendingPeriodoNumeros?: number[];
  hideNavigation?: boolean;
};

export function PautaRapidaModal({
  initialTurmaId,
  initialPeriodoNumero,
  initialDisciplinaId,
  initialTurmaLabel,
  lockTurma = false,
  showPeriodoTabs = false,
  pendingPeriodoNumeros = [],
  hideNavigation = false,
}: PautaRapidaModalProps) {
  const router = useRouter();
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [periodoNumero, setPeriodoNumero] = useState<number>(1);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(false);
  const [exportingMiniPauta, setExportingMiniPauta] = useState(false);
  const [exportingTrimestral, setExportingTrimestral] = useState(false);
  const [pautaInitial, setPautaInitial] = useState<StudentGradeRow[]>([]);
  const [pautaDraft, setPautaDraft] = useState<StudentGradeRow[]>([]);
  const [loadingPauta, setLoadingPauta] = useState(false);
  const { gerarMiniPauta, gerarPautaTrimestral } = useOfficialDocs();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    if (initialTurmaId && initialTurmaId !== turmaId) {
      setTurmaId(initialTurmaId);
      setDisciplinaId("");
    }
  }, [initialTurmaId, turmaId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (lockTurma) return;
      setLoadingTurmas(true);
      try {
        const params = new URLSearchParams({ ano: String(anoLetivo) });
        const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
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
  }, [accessToken, anoLetivo, lockTurma]);

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
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setDisciplinas(json.items || []);
          setPeriodos(json.periodos || []);
          const firstNumero = json.periodos?.[0]?.numero;
          if (typeof firstNumero === "number") {
            setPeriodoNumero(firstNumero);
          }
        } else {
          setDisciplinas([]);
          setPeriodos([]);
        }
      } finally {
        if (active) setLoadingDisciplinas(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [accessToken, turmaId]);

  useEffect(() => {
    if (typeof initialPeriodoNumero !== "number") return;
    if (!periodos.length) return;
    const target = periodos.find((p) => p.numero === initialPeriodoNumero);
    if (target) setPeriodoNumero(target.numero);
  }, [initialPeriodoNumero, periodos]);

  useEffect(() => {
    if (!turmaId || !disciplinaId || !periodoNumero) {
      setPautaInitial([]);
      setPautaDraft([]);
      return;
    }

    let active = true;
    const load = async () => {
      setLoadingPauta(true);
      try {
        const params = new URLSearchParams({
          disciplinaId,
          trimestre: String(periodoNumero),
        });
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?${params.toString()}`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok && Array.isArray(json.items)) {
          const mapped =
            json.items.map((row: any, index: number) => ({
              id: row.aluno_id,
              numero: row.numero_chamada ?? index + 1,
              nome: row.nome,
              foto: row.foto ?? null,
              mac1: row.mac ?? null,
              npp1: row.npp ?? null,
              npt1: row.npt ?? null,
              mt1: row.mt ?? null,
              _status: "synced",
            }));
          setPautaInitial(mapped);
          setPautaDraft(mapped);
        } else {
          setPautaInitial([]);
          setPautaDraft([]);
        }
      } finally {
        if (active) setLoadingPauta(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [accessToken, turmaId, disciplinaId, periodoNumero]);

  const disciplinasFiltradas = useMemo(() => {
    return disciplinas.filter((disciplina) => {
      const periodosAtivos = disciplina.meta?.periodos_ativos;
      if (!periodosAtivos || periodosAtivos.length === 0) return true;
      return periodosAtivos.includes(periodoNumero);
    });
  }, [disciplinas, periodoNumero]);

  useEffect(() => {
    if (!initialDisciplinaId) return;
    if (disciplinaId) return;
    const exists = disciplinasFiltradas.some((disc) => disc.disciplina?.id === initialDisciplinaId);
    if (exists) {
      setDisciplinaId(initialDisciplinaId);
    }
  }, [disciplinaId, disciplinasFiltradas, initialDisciplinaId]);

  const turmaSelecionada = useMemo(
    () => turmas.find((t) => t.id === turmaId) ?? null,
    [turmas, turmaId]
  );

  const disciplinaSelecionada = useMemo(
    () => disciplinasFiltradas.find((d) => d.disciplina?.id === disciplinaId) ?? null,
    [disciplinasFiltradas, disciplinaId]
  );

  useEffect(() => {
    if (!disciplinaId) return;
    const stillValid = disciplinasFiltradas.some((disc) => disc.disciplina?.id === disciplinaId);
    if (!stillValid) setDisciplinaId("");
  }, [disciplinaId, disciplinasFiltradas]);

  const turmaLabel =
    initialTurmaLabel ||
    (turmaSelecionada ? turmaSelecionada.turma_nome || turmaSelecionada.nome || "Turma" : "Turma");

  const handleOpen = (path: string) => {
    if (!turmaId) return;
    window.location.href = path;
  };

  const handleExportMiniPauta = async () => {
    if (!turmaId || !disciplinaId) return;
    setExportingMiniPauta(true);
    try {
      const params = new URLSearchParams({
        disciplinaId,
        periodoNumero: String(periodoNumero),
      });
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/mini-pauta?${params.toString()}`, {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.payload) {
        return;
      }
      const payload = json.payload as MiniPautaPayload;
      payload.metadata.trimestresAtivos = [periodoNumero as 1 | 2 | 3];
      payload.metadata.mostrarTrimestresInativos = false;
      const filename = `MiniPauta_${payload.metadata.disciplina}_${Date.now()}.pdf`;
      await gerarMiniPauta(payload, filename);
    } finally {
      setExportingMiniPauta(false);
    }
  };

  const handleExportPautaTrimestral = async () => {
    if (!turmaId || !disciplinaId) return;
    if (![1, 2, 3].includes(periodoNumero)) return;
    setExportingTrimestral(true);
    try {
      const params = new URLSearchParams({
        disciplinaId,
        periodoNumero: String(periodoNumero),
      });
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-trimestral?${params.toString()}`, {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.payload) {
        return;
      }
      const payload = json.payload as MiniPautaPayload;
      const filename = `PautaTrimestral_${payload.metadata.disciplina}_${Date.now()}.pdf`;
      await gerarPautaTrimestral(payload, periodoNumero as TrimestreNumero, filename);
    } finally {
      setExportingTrimestral(false);
    }
  };

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (!turmaId || !disciplinaId) return;
    const turmaDisciplinaId = disciplinaSelecionada?.id ?? null;
    const disciplinaCanonicalId = disciplinaSelecionada?.disciplina?.id ?? disciplinaId;
    if (!turmaDisciplinaId) {
      throw new Error("Disciplina inválida para lançamento.");
    }
    const payloads = [
      { tipo: "MAC", campo: "mac1" as const },
      { tipo: "NPP", campo: "npp1" as const },
      { tipo: "NPT", campo: "npt1" as const },
    ];

    for (const { tipo, campo } of payloads) {
      const notas = rows
        .map((row) => ({ aluno_id: row.id, valor: row[campo] }))
        .filter((entry) => typeof entry.valor === "number");
      if (notas.length === 0) continue;

      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const res = await fetch(`/api/secretaria/notas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          turma_id: turmaId,
          disciplina_id: disciplinaCanonicalId,
          turma_disciplina_id: turmaDisciplinaId,
          trimestre: periodoNumero,
          tipo_avaliacao: tipo,
          notas,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar notas");
      }
    }

    setPautaDraft((prev) =>
      prev.map((row) => {
        const updated = rows.find((candidate) => candidate.id === row.id);
        return updated ? { ...row, ...updated, _status: "synced" } : row;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {!lockTurma && (
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Ano letivo</label>
            <input
              type="number"
              value={anoLetivo}
              onChange={(event) => setAnoLetivo(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Turma</label>
          {lockTurma ? (
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {turmaLabel}
            </div>
          ) : (
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
          )}
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
            {disciplinasFiltradas.map((disciplina) => (
              <option key={disciplina.id} value={disciplina.disciplina?.id ?? ""}>
                {disciplina.disciplina?.nome ?? "Disciplina"}
              </option>
            ))}
          </select>
          {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Período</label>
        {showPeriodoTabs && periodos.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {periodos.map((periodo) => {
              const active = periodo.numero === periodoNumero
              const hasPendencia = pendingPeriodoNumeros.includes(periodo.numero)
              return (
                <button
                  key={periodo.id}
                  type="button"
                  onClick={() => setPeriodoNumero(periodo.numero)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-klasse-green text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {`Trimestre ${periodo.numero}`}
                    {hasPendencia ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-rose-500"}`} />
                    ) : null}
                  </span>
                </button>
              )
            })}
            {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <select
              value={periodoNumero}
              onChange={(event) => setPeriodoNumero(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={!turmaId || periodos.length === 0}
            >
              {periodos.length === 0 && (
                <option value={periodoNumero}>Sem períodos</option>
              )}
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.numero}>
                  {`Período ${periodo.numero}`}
                </option>
              ))}
            </select>
            {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        )}
      </div>

      {!lockTurma && (
        <>
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
              onClick={handleExportMiniPauta}
              disabled={!turmaId || !disciplinaId || exportingMiniPauta}
              className="flex items-center justify-center gap-2 rounded-lg bg-klasse-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {exportingMiniPauta ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Mini-pauta (PDF)
            </button>
            <button
              type="button"
              onClick={handleExportPautaTrimestral}
              disabled={!turmaId || !disciplinaId || exportingTrimestral || periodos.length === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-klasse-gold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {exportingTrimestral ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Pauta Trimestral (PDF)
            </button>
            {!hideNavigation && (
              <button
                type="button"
                onClick={() =>
                  turmaId && router.push(`/secretaria/notas?turmaId=${turmaId}&disciplinaId=${disciplinaId}`)
                }
                disabled={!turmaId}
                className="flex items-center justify-center gap-2 rounded-lg bg-klasse-gold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Gerenciar notas da {turmaLabel}
              </button>
            )}
          </div>
        </>
      )}

      {disciplinaSelecionada ? (
        <p className="text-xs text-slate-500">
          Disciplina selecionada: {disciplinaSelecionada.disciplina?.nome ?? "—"}
        </p>
      ) : null}

      {loadingPauta ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Carregando pauta...
        </div>
      ) : pautaInitial.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Selecione turma, disciplina e período para visualizar a pauta.
        </div>
      ) : (
        <GradeEntryGrid
          initialData={pautaInitial}
          subtitle={`${disciplinaSelecionada?.disciplina?.nome ?? "Disciplina"} • Trimestre ${periodoNumero}`}
          onSave={handleSaveBatch}
          onDataChange={setPautaDraft}
        />
      )}
    </div>
  );
}
