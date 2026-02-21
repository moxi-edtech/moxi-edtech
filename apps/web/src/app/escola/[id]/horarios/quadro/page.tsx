"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Save, WifiOff } from "lucide-react";
import { SchedulerBoard } from "@/components/escola/horarios/SchedulerBoard";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { useHorarioBaseData, useHorarioTurmaData } from "@/hooks/useHorarioData";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

export default function QuadroHorariosPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const { online } = useOfflineStatus();
  const [isMounted, setIsMounted] = useState(false);

  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const [novaSala, setNovaSala] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  const {
    slots,
    slotLookup,
    salas,
    turmas,
    loading: baseLoading,
    error: baseError,
    setSalas,
  } = useHorarioBaseData(escolaId);

  const {
    aulas,
    grid,
    existingAssignments,
    loading: turmaLoading,
    error: turmaError,
    setAulas,
    setGrid,
  } = useHorarioTurmaData({ escolaId, turmaId, versaoId, slotLookup, refreshToken });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!escolaId) return;
    const key = `horarios:versao:${escolaId}`;
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (stored) {
      setVersaoId(stored);
      return;
    }
    const next = crypto.randomUUID();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(key, next);
    }
    setVersaoId(next);
  }, [escolaId]);

  useEffect(() => {
    if (turmas.length === 0) {
      setTurmaId(null);
      return;
    }
    setTurmaId((prev) => {
      if (prev && turmas.some((turma) => turma.id === prev)) return prev;
      return turmas[0]?.id ?? null;
    });
  }, [turmas]);

  const turmaOptions = useMemo(() => {
    if (turmas.length === 0) {
      return [{ value: "", label: "Sem turmas" }];
    }
    return [
      { value: "", label: "Selecione uma turma" },
      ...turmas.map((turma) => ({
        value: turma.id,
        label:
          turma.turma_codigo ||
          turma.turma_code ||
          turma.turma_nome ||
          turma.nome ||
          turma.id,
      })),
    ];
  }, [turmas]);

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === turmaId) || null,
    [turmaId, turmas]
  );

  const horariosDisponiveis = useMemo(() => (slots.length > 0 ? slots : undefined), [slots]);
  const missingLoad = useMemo(() => aulas.filter((aula) => aula.missingLoad), [aulas]);
  const missingLoadCount = missingLoad.length;
  const canPublicar = missingLoadCount === 0;
  const isLoading = baseLoading || turmaLoading;
  const showOfflineStatus = isMounted && !online;
  const totalDias = useMemo(() => {
    const unique = new Set(Object.keys(slotLookup).map((key) => key.split("-")[0]));
    return unique.size || 5;
  }, [slotLookup]);
  const temposAulaCount = useMemo(
    () => (horariosDisponiveis ?? []).filter((slot) => slot.tipo !== "intervalo").length,
    [horariosDisponiveis]
  );
  const totalSlots = totalDias * temposAulaCount;
  const filledSlots = useMemo(
    () => Object.values(grid).filter((value) => Boolean(value)).length,
    [grid]
  );
  const totalCarga = useMemo(
    () => aulas.reduce((acc, aula) => acc + (aula.temposTotal || 0), 0),
    [aulas]
  );
  const excessoCarga = Math.max(0, totalCarga - totalSlots);
  const turnoLabel = useMemo(() => {
    const turno = selectedTurma?.turno?.toString().toUpperCase() ?? "";
    if (turno === "M") return "manhã";
    if (turno === "T") return "tarde";
    if (turno === "N") return "noite";
    return "turno";
  }, [selectedTurma?.turno]);
  const disciplinasCompletas = useMemo(
    () => aulas.filter((aula) => !aula.missingLoad && aula.temposTotal > 0 && aula.temposAlocados >= aula.temposTotal).length,
    [aulas]
  );
  const disciplinasPendentes = useMemo(
    () =>
      aulas.filter(
        (aula) => aula.missingLoad || (aula.temposTotal > 0 && aula.temposAlocados < aula.temposTotal)
      ),
    [aulas]
  );
  const conflitosCount = Object.keys(conflictSlots).length;
  const professorLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulas) {
      if (!aula.professorId) continue;
      const entry = map.get(aula.professorId) || {
        id: aula.professorId,
        nome: aula.professor || "Professor",
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.professorId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulas]);
  const salaLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulas) {
      if (!aula.salaId) continue;
      const sala = salas.find((item) => item.id === aula.salaId);
      const entry = map.get(aula.salaId) || {
        id: aula.salaId,
        nome: sala?.nome ?? `Sala ${aula.salaId.slice(0, 4)}`,
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.salaId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulas, salas]);
  const overloadProfessores = professorLoad.filter((item) => item.count >= 16);
  const overloadSalas = salaLoad.filter((item) => item.count >= 20);

  const submitQuadro = async (nextGrid: Record<string, string | null>, mode: "draft" | "publish") => {
    if (!escolaId || !turmaId || !versaoId) return;

    if (mode === "draft") {
      setSaving(true);
    } else {
      setPublishing(true);
    }
    setSaveError(null);

    const items = Object.entries(nextGrid)
      .map(([slotKey, disciplinaId]) => ({ slotKey, disciplinaId }))
      .filter(({ slotKey, disciplinaId }) => disciplinaId && slotLookup[slotKey])
      .map(({ slotKey, disciplinaId }) => {
        const aula = aulas.find((item) => item.id === disciplinaId);
        return {
          slot_id: slotLookup[slotKey],
          disciplina_id: disciplinaId as string,
          professor_id: aula?.professorId ?? null,
          sala_id: aula?.salaId ?? null,
        };
      });

    const payload = {
      versao_id: versaoId,
      turma_id: turmaId,
      items,
      mode,
    };

    setGrid(() => nextGrid);

    try {
      if (!online && mode === "draft") {
        await enqueueOfflineAction({
          url: `/api/escolas/${escolaId}/horarios/quadro`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          type: "horarios_quadro",
        });
        toast.message("Quadro salvo no dispositivo.", {
          description: "Sincronizaremos quando a conexão voltar.",
        });
        return;
      }
      if (!online && mode === "publish") {
        toast.error("Modo offline: conecte-se para publicar o quadro.");
        return;
      }

      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setSaveError(json?.error || "Falha ao salvar quadro");
        if (json?.conflicts && Array.isArray(json.conflicts)) {
          const nextConflicts: Record<string, boolean> = {};
          for (const conflict of json.conflicts) {
            const slotKey = Object.entries(slotLookup).find(([, id]) => id === conflict.slot_id)?.[0];
            if (slotKey) nextConflicts[slotKey] = true;
          }
          setConflictSlots(nextConflicts);
        }
        if (json?.details?.missing?.length) {
          const nomes = json.details.missing
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          toast.error("Cargas horárias pendentes", {
            description: nomes.length ? nomes.join(", ") : json?.error,
          });
        }
        if (json?.details?.mismatch?.length) {
          const nomes = json.details.mismatch
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          toast.error("Distribuição incompleta", {
            description: nomes.length ? nomes.join(", ") : json?.error,
          });
        }
        return;
      }

      setConflictSlots({});
      toast.success(mode === "publish" ? "Quadro publicado!" : "Quadro salvo!", {
        description:
          mode === "publish"
            ? "Publicação concluída sem pendências."
            : "Você pode ajustar a distribuição a qualquer momento.",
        duration: 5000,
      });
    } finally {
      if (mode === "draft") {
        setSaving(false);
      } else {
        setPublishing(false);
      }
    }
  };

  const handleSalvar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "draft");
  const handlePublicar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "publish");

  const handleAutoConfigurar = async () => {
    if (!escolaId || !turmaId) return;
    setAutoConfiguring(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/cargas/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId, strategy: "preset_then_default", overwrite: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Cargas preenchidas", {
          description: `${json?.data?.updated ?? 0} disciplina(s) atualizadas.`,
        });
        setRefreshToken((prev) => prev + 1);
      } else {
        toast.error(json?.error || "Falha ao configurar cargas");
      }
    } finally {
      setAutoConfiguring(false);
    }
  };

  const handleAutoCompletar = async () => {
    if (!escolaId || !turmaId) return;
    setAutoScheduling(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId, strategy: "v1", overwrite_unlocked: true, dry_run: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        toast.error(json?.error || "Falha ao auto-completar o quadro");
        return;
      }

      const reverseLookup: Record<string, string> = {};
      for (const [key, id] of Object.entries(slotLookup)) {
        reverseLookup[id] = key;
      }

      const nextGrid: Record<string, string | null> = {};
      const countByDisc: Record<string, number> = {};
      for (const assignment of json.assignments || []) {
        const slotKey = reverseLookup[assignment.slot_id];
        if (!slotKey) continue;
        nextGrid[slotKey] = assignment.disciplina_id;
        countByDisc[assignment.disciplina_id] = (countByDisc[assignment.disciplina_id] || 0) + 1;
      }

      setGrid(() => nextGrid);
      setAulas((prev) =>
        prev.map((aula) => ({
          ...aula,
          temposAlocados: countByDisc[aula.id] ?? 0,
        }))
      );
      setConflictSlots({});
      toast.success("Quadro gerado", {
        description: `Preenchidos ${json?.stats?.filled ?? 0} de ${json?.stats?.total_slots ?? 0} slots.`,
      });
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleAddSala = async (nome: string) => {
    if (!nome.trim() || !escolaId) return;
    const res = await fetch(`/api/escolas/${escolaId}/salas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.item) {
      setSalas((prev) => [...prev, json.item]);
      toast.success("Sala adicionada.");
      return;
    }
    toast.error(json?.error || "Falha ao adicionar sala.");
  };

  if (isLoading && !turmaId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <Spinner className="text-klasse-gold" size={24} />
        <span className="ml-3 text-sm">Carregando quadro...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <Link
                href={`/escola/${escolaId}/horarios/slots`}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Slots
              </Link>
              <Link
                href={`/escola/${escolaId}/horarios/quadro`}
                className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Quadro
              </Link>
            </div>
            <Select
              value={turmaId ?? ""}
              options={turmaOptions}
              onChange={(event) => setTurmaId(event.target.value || null)}
              className="max-w-xs rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold text-slate-900"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner size={14} className="text-klasse-gold" />
                Sincronizando dados...
              </div>
            ) : null}
            {showOfflineStatus ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <WifiOff className="h-3 w-3" />
                Modo offline
              </div>
            ) : null}
            {baseError ? <span className="text-xs text-rose-600">{baseError}</span> : null}
            {turmaError ? <span className="text-xs text-rose-600">{turmaError}</span> : null}
            {saveError ? <span className="text-xs text-rose-600">{saveError}</span> : null}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Save className={`h-4 w-4 ${saving ? "text-klasse-gold" : "text-slate-300"}`} />
              <span>{saving ? "Salvando..." : "Alterações prontas"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {turmaId && excessoCarga > 0 && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Carga acima da capacidade</p>
            <p className="text-xs text-rose-700 mt-1">
              Carga total: {totalCarga} • Slots disponíveis: {totalSlots} • Excesso: {excessoCarga}
            </p>
            <p className="text-xs text-rose-700 mt-2">
              A carga horária do curso ({totalCarga}) excede a capacidade do turno da {turnoLabel} ({totalSlots}).
              Altere o currículo ou aloque aulas no contraturno.
            </p>
          </div>
        )}
        {turmaId && (
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Slots preenchidos</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {filledSlots}/{totalSlots || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalDias} dia(s) • {temposAulaCount} tempos/dia
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Disciplinas completas</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {disciplinasCompletas}/{aulas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Meta semanal por disciplina</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pendências de carga</p>
              <p className="text-2xl font-bold text-amber-600 mt-2">{missingLoadCount}</p>
              <p className="text-xs text-slate-500 mt-1">Sem carga definida</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Conflitos detectados</p>
              <p className="text-2xl font-bold text-rose-600 mt-2">{conflitosCount}</p>
              <p className="text-xs text-slate-500 mt-1">Professor/Sala</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sobrecarga</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overloadProfessores.length + overloadSalas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Professores + salas</p>
            </div>
          </div>
        )}
        {turmaId && disciplinasPendentes.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Disciplinas pendentes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {disciplinasPendentes.slice(0, 6).map((disc) => (
                <span
                  key={disc.id}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {disc.disciplina} {disc.temposAlocados}/{disc.temposTotal || "?"}
                </span>
              ))}
              {disciplinasPendentes.length > 6 && (
                <span className="text-xs text-slate-500">+{disciplinasPendentes.length - 6} mais</span>
              )}
            </div>
          </div>
        )}
        {turmaId && (overloadProfessores.length > 0 || overloadSalas.length > 0) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Alertas de sobrecarga</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overloadProfessores.map((prof) => (
                <span
                  key={`prof-${prof.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {prof.nome}: {prof.count} tempos
                </span>
              ))}
              {overloadSalas.map((sala) => (
                <span
                  key={`sala-${sala.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {sala.nome}: {sala.count} tempos
                </span>
              ))}
            </div>
          </div>
        )}
        {missingLoadCount > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">{missingLoadCount} disciplina(s) sem carga horária.</div>
            <div className="mt-1">Defina as cargas para publicar o quadro.</div>
          </div>
        )}
        {!turmaId ? (
          <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Selecione uma turma para montar o quadro.</p>
          </div>
        ) : (
          <SchedulerBoard
            diasSemana={DIAS_SEMANA}
            tempos={horariosDisponiveis}
            aulas={aulas}
            onSalvar={handleSalvar}
            grid={grid}
            onGridChange={(next) => setGrid(() => next)}
            slotLookup={slotLookup}
            existingAssignments={existingAssignments}
            conflictSlots={conflictSlots}
            salas={salas}
            onSalaChange={(aulaId, salaId) => {
              setAulas((prev) => prev.map((aula) => (aula.id === aulaId ? { ...aula, salaId } : aula)));
            }}
            onAutoCompletar={handleAutoCompletar}
            autoCompleting={autoScheduling}
            onAutoConfigurarCargas={missingLoadCount > 0 ? handleAutoConfigurar : undefined}
            autoConfiguring={autoConfiguring}
            onPublicar={handlePublicar}
            canPublicar={canPublicar}
            publishDisabledReason={
              canPublicar ? undefined : "Defina todas as cargas horárias antes de publicar."
            }
            publishing={publishing}
          />
        )}

        {turmaId ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Adicionar sala"
              value={novaSala}
              onChange={(event) => setNovaSala(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold"
            />
            <button
              type="button"
              onClick={() => {
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-slate-950 shadow-sm"
            >
              Adicionar sala
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
