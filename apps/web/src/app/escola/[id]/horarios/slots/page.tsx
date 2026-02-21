"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SlotsConfig, type HorarioSlot } from "@/components/escola/horarios/SlotsConfig";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { shouldAppearInScheduler } from "@/lib/rules/scheduler-rules";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/Spinner";

type Turno = {
  id: string;
  label: string;
};

type TurmaResumo = {
  id: string;
  nome: string;
  turno?: string | null;
  curso_nome?: string | null;
  classe_nome?: string | null;
};

export default function HorariosSlotsPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [turmaCarga, setTurmaCarga] = useState(0);
  const [disciplinasSemCarga, setDisciplinasSemCarga] = useState(0);
  const { online } = useOfflineStatus();
  const requestRef = useRef(0);

  const turnos = useMemo<Turno[]>(
    () => [
      { id: "matinal", label: "Matinal" },
      { id: "tarde", label: "Tarde" },
      { id: "noite", label: "Noite" },
    ],
    []
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const turmaIdParam = searchParams?.get("turmaId");
    if (turmaIdParam) setSelectedTurmaId(turmaIdParam);
  }, [searchParams]);

  useEffect(() => {
    if (!escolaId) return;
    const controller = new AbortController();
    const requestId = ++requestRef.current;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        if (res.ok && json.ok) {
          setSlots(json.items || []);
        } else {
          setSlots([]);
        }
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setSlots([]);
      } finally {
        if (!controller.signal.aborted && requestId === requestRef.current) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    const controller = new AbortController();
    const requestId = ++requestRef.current;

    const loadTurmas = async () => {
      setLoadingTurmas(true);
      try {
        const res = await fetch(`/api/escolas/${escolaId}/turmas?limit=50`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        const items = res.ok && json.ok && Array.isArray(json.items) ? json.items : [];
        setTurmas(
          items.map((item: any) => ({
            id: item.id,
            nome: item.nome ?? item.turma_nome ?? "Turma",
            turno: item.turno ?? null,
            curso_nome: item.curso_nome ?? null,
            classe_nome: item.classe_nome ?? null,
          }))
        );
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setTurmas([]);
      } finally {
        if (!controller.signal.aborted && requestId === requestRef.current) {
          setLoadingTurmas(false);
        }
      }
    };

    loadTurmas();
    return () => controller.abort();
  }, [escolaId]);

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === selectedTurmaId) || null,
    [selectedTurmaId, turmas]
  );

  const turnoSlotId = useMemo(() => {
    const turno = (selectedTurma?.turno || "").toUpperCase();
    if (turno === "M") return "matinal";
    if (turno === "T") return "tarde";
    if (turno === "N") return "noite";
    return null;
  }, [selectedTurma]);

  const totalSlotsDisponiveis = useMemo(() => {
    const filtered = turnoSlotId
      ? slots.filter((slot) => slot.turno_id === turnoSlotId)
      : slots;
    return filtered.filter((slot) => !slot.is_intervalo).length;
  }, [slots, turnoSlotId]);

  useEffect(() => {
    if (!escolaId || !selectedTurmaId) {
      setTurmaCarga(0);
      setDisciplinasSemCarga(0);
      return;
    }
    const controller = new AbortController();
    const requestId = ++requestRef.current;

    const loadCarga = async () => {
      try {
        const res = await fetch(
          `/api/secretaria/turmas/${selectedTurmaId}/disciplinas?escola_id=${encodeURIComponent(
            escolaId
          )}`,
          { cache: "no-store", signal: controller.signal }
        );
        const json = await res.json().catch(() => ({}));
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        const items = res.ok && json.ok && Array.isArray(json.items) ? json.items : [];
        let total = 0;
        let missing = 0;
        items.forEach((item: any) => {
          const meta = item?.meta ?? {};
          if (!shouldAppearInScheduler(meta)) return;
          const carga = Number(meta.carga_horaria_semanal ?? 0);
          if (carga > 0) total += carga;
          else missing += 1;
        });
        setTurmaCarga(total);
        setDisciplinasSemCarga(missing);
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setTurmaCarga(0);
        setDisciplinasSemCarga(0);
      }
    };

    loadCarga();
    return () => controller.abort();
  }, [escolaId, selectedTurmaId]);

  const excessoCarga = useMemo(() => {
    if (!selectedTurmaId) return 0;
    return Math.max(0, turmaCarga - totalSlotsDisponiveis);
  }, [selectedTurmaId, turmaCarga, totalSlotsDisponiveis]);

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const request = {
        url: `/api/escolas/${escolaId}/horarios/slots`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
        type: "horarios_slots",
      };

      if (!online) {
        await enqueueOfflineAction(request);
        toast.message("Configuração enviada para sincronização.");
        return;
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setSlots(json.items || []);
        toast.success("Estrutura de horários salva!", {
          description: "Agora você pode distribuir as aulas nas turmas.",
          action: {
            label: "Ir para o Quadro",
            onClick: () => router.push(`/escola/${escolaId}/horarios/quadro`),
          },
          duration: 5000,
        });
      } else {
        setSaveError(json?.error || "Falha ao salvar slots");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Estrutura de Horários</h1>
            <p className="text-sm text-slate-500">
              Configure os tempos e intervalos que serão usados no quadro.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTurmaId ?? ""}
              onChange={(event) => setSelectedTurmaId(event.target.value || null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="">Selecione uma turma</option>
              {loadingTurmas ? (
                <option value="">Carregando turmas...</option>
              ) : (
                turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}
                    {turma.classe_nome ? ` • ${turma.classe_nome}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
            <Link
              href={`/escola/${escolaId}/horarios/slots`}
              className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Slots
            </Link>
            <Link
              href={`/escola/${escolaId}/horarios/quadro`}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
            >
              Quadro
            </Link>
          </div>
        </div>

        {selectedTurmaId && (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              excessoCarga > 0
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Capacidade semanal para {selectedTurma?.nome}</p>
                <p className="text-xs mt-1">
                  Slots disponíveis: {totalSlotsDisponiveis} • Carga total: {turmaCarga}
                  {excessoCarga > 0 ? ` • Excesso: ${excessoCarga}` : ""}
                </p>
                {disciplinasSemCarga > 0 && (
                  <p className="text-xs mt-1">
                    {disciplinasSemCarga} disciplina(s) sem carga semanal configurada.
                  </p>
                )}
              </div>
              <Link
                href={`/escola/${escolaId}/horarios/quadro`}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Abrir Quadro
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Spinner className="text-klasse-gold" size={24} />
              <span className="ml-3 text-sm">Carregando horários...</span>
            </div>
          ) : (
            <SlotsConfig turnos={turnos} value={slots} onChange={setSlots} onSave={handleSave} />
          )}
        </div>

        <div className="text-xs text-slate-500">
          {saving
            ? "Salvando configuração..."
            : hasMounted && !online
              ? "Offline: alterações serão sincronizadas."
              : ""}
          {saveError ? <span className="ml-2 text-rose-600">{saveError}</span> : null}
        </div>
      </div>
    </div>
  );
}
