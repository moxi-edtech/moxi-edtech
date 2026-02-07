"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const [novaSala, setNovaSala] = useState("");

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
  } = useHorarioTurmaData({ escolaId, turmaId, versaoId, slotLookup });

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
        label: turma.turma_nome || turma.nome || turma.id,
      })),
    ];
  }, [turmas]);

  const horariosDisponiveis = useMemo(() => (slots.length > 0 ? slots : undefined), [slots]);
  const isLoading = baseLoading || turmaLoading;
  const showOfflineStatus = isMounted && !online;

  const handleSalvar = async (nextGrid: Record<string, string | null>) => {
    if (!escolaId || !turmaId || !versaoId) return;

    setSaving(true);
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
    };

    setGrid(() => nextGrid);

    try {
      if (!online) {
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
        return;
      }

      setConflictSlots({});
    } finally {
      setSaving(false);
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
        <div className="flex flex-wrap items-center gap-4 px-6 py-4">
          <Select
            value={turmaId ?? ""}
            options={turmaOptions}
            onChange={(event) => setTurmaId(event.target.value || null)}
            className="max-w-xs rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold text-slate-900"
          />
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
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <Save className={`h-4 w-4 ${saving ? "text-klasse-gold" : "text-slate-300"}`} />
            <span>{saving ? "Salvando..." : "Alterações prontas"}</span>
          </div>
        </div>
      </header>

      <div className="px-6 py-4">
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
