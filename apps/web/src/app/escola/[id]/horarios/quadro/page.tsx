"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SchedulerBoard, type SchedulerAula, type SchedulerSlot } from "@/components/escola/horarios/SchedulerBoard";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";

type SlotApi = {
  id: string;
  turno_id: string;
  dia_semana: number;
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo?: boolean | null;
};

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const mapSlots = (slots: SlotApi[]): SchedulerSlot[] => {
  const grouped = new Map<number, SlotApi>();
  for (const slot of slots) {
    if (slot.dia_semana < 1 || slot.dia_semana > 5) continue;
    if (!grouped.has(slot.ordem)) {
      grouped.set(slot.ordem, slot);
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.ordem - b.ordem)
    .map((slot) => ({
      id: String(slot.ordem),
      label: `${slot.inicio} - ${slot.fim}`,
      tipo: slot.is_intervalo ? "intervalo" : "aula",
    }));
};

export default function QuadroHorariosPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const [slots, setSlots] = useState<SchedulerSlot[]>([]);
  const [slotLookup, setSlotLookup] = useState<Record<string, string>>({});
  const [aulas, setAulas] = useState<SchedulerAula[]>([]);
  const [turmas, setTurmas] = useState<
    Array<{ id: string; nome?: string | null; turma_nome?: string | null }>
  >([]);
  const [salas, setSalas] = useState<Array<{ id: string; nome: string }>>([]);
  const [novaSala, setNovaSala] = useState("");
  const [salasFeedback, setSalasFeedback] = useState<string | null>(null);
  const [grid, setGrid] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const { online } = useOfflineStatus();
  const [existingAssignments, setExistingAssignments] = useState<
    Array<{ slot_id: string; professor_id: string | null; sala_id?: string | null }>
  >([]);

  useEffect(() => {
    if (!escolaId) return;
    const key = `horarios:versao:${escolaId}`;
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (stored) {
      setVersaoId(stored);
    } else {
      const next = crypto.randomUUID();
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, next);
      }
      setVersaoId(next);
    }
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          const items = (json.items || []) as SlotApi[];
          setSlots(mapSlots(items));
          const lookup: Record<string, string> = {};
          for (const slot of items) {
            if (slot.dia_semana < 1 || slot.dia_semana > 5) continue;
            const dia = DIAS_SEMANA[slot.dia_semana - 1];
            lookup[`${dia}-${slot.ordem}`] = slot.id;
          }
          setSlotLookup(lookup);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const load = async () => {
      const res = await fetch(`/api/escolas/${escolaId}/salas`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.ok && json.ok) {
        setSalas(json.items || []);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const load = async () => {
      const res = await fetch(`/api/secretaria/turmas-simples?ano=${new Date().getFullYear()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.ok && json.ok && Array.isArray(json.items)) {
        const items = json.items as Array<{ id: string; turma_nome?: string | null; nome?: string | null }>;
        setTurmas(items);
        if (items.length > 0) {
          setTurmaId((prev) => prev ?? items[0].id);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    if (!turmaId) return;
    let active = true;
    const load = async () => {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.ok && json.ok && Array.isArray(json.items)) {
        const next = json.items.map((item: any) => ({
          id: item.disciplina?.id ?? item.id,
          disciplina: item.disciplina?.nome ?? "Disciplina",
          sigla: (item.disciplina?.nome ?? "").slice(0, 3).toUpperCase() || "DISC",
          professor: item.professor?.nome ?? "—",
          professorId: item.professor?.id ?? null,
          salaId: null,
          cor: "bg-slate-100 border-slate-300 text-slate-800",
          temposTotal: Number(item.meta?.carga_horaria_semanal ?? 1),
          temposAlocados: 0,
        })) as SchedulerAula[];
        setAulas(next);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [turmaId]);

  useEffect(() => {
    if (!escolaId || !turmaId || !versaoId) return;
    let active = true;
    const load = async () => {
      const params = new URLSearchParams({
        versao_id: versaoId,
        turma_id: turmaId,
      });
      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!active) return;
      if (res.ok && json.ok && Array.isArray(json.items)) {
        const nextGrid: Record<string, string | null> = {};
        for (const item of json.items) {
          const slotKey = Object.entries(slotLookup).find(([, id]) => id === item.slot_id)?.[0];
          if (slotKey) {
            nextGrid[slotKey] = item.disciplina_id;
          }
        }
        setGrid(nextGrid);
        setExistingAssignments(
          (json.items || []).map((item: any) => ({
            slot_id: item.slot_id,
            professor_id: item.professor_id ?? null,
            sala_id: item.sala_id ?? null,
          }))
        );
      } else {
        setGrid({});
        setExistingAssignments([]);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [escolaId, turmaId, versaoId, slotLookup]);

  const handleSalvar = async (grid: Record<string, string | null>) => {
    if (!escolaId || !turmaId || !versaoId) return;
    const items = Object.entries(grid)
      .map(([slotKey, disciplinaId]) => ({
        slotKey,
        disciplinaId,
      }))
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

    setSaveError(null);

    const request = {
      url: `/api/escolas/${escolaId}/horarios/quadro`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versao_id: versaoId,
        turma_id: turmaId,
        items,
      }),
      type: "horarios_quadro",
    };

    if (!online) {
      await enqueueOfflineAction(request);
      setGrid(grid);
      return;
    }

    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
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
    setGrid(grid);
  };

  const horariosDisponiveis = useMemo(() => {
    if (slots.length === 0) {
      return [
        { id: "t1", label: "07:30 - 08:15", tipo: "aula" },
        { id: "t2", label: "08:20 - 09:05", tipo: "aula" },
        { id: "int", label: "Intervalo", tipo: "intervalo" },
        { id: "t3", label: "09:25 - 10:10", tipo: "aula" },
      ] as SchedulerSlot[];
    }
    return slots;
  }, [slots]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando quadro...</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
        <select
          value={turmaId ?? ""}
          onChange={(event) => setTurmaId(event.target.value || null)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {turmas.length === 0 && <option value="">Sem turmas</option>}
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.turma_nome || turma.nome || turma.id}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">Configurar quadro por turma</span>
        {!online ? (
          <span className="text-xs text-amber-600">Offline: alterações serão sincronizadas.</span>
        ) : null}
        {saveError ? <span className="text-xs text-rose-600">{saveError}</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white">
        <div className="text-xs font-semibold text-slate-500 uppercase">Salas</div>
        <div className="flex items-center gap-2">
          <input
            value={novaSala}
            onChange={(event) => setNovaSala(event.target.value)}
            placeholder="Adicionar sala"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              if (!novaSala.trim()) return;
              setSalasFeedback(null);
              const res = await fetch(`/api/escolas/${escolaId}/salas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: novaSala.trim() }),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json.ok && json.item) {
                setSalas((prev) => [...prev, json.item]);
                setNovaSala("");
                setSalasFeedback("Sala adicionada.");
              } else {
                setSalasFeedback(json?.error || "Falha ao adicionar sala.");
              }
            }}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Adicionar
          </button>
        </div>
        {salas.length === 0 ? (
          <span className="text-xs text-slate-400">Sem salas cadastradas.</span>
        ) : null}
        {salasFeedback ? (
          <span className={`text-xs ${salasFeedback === "Sala adicionada." ? "text-emerald-600" : "text-rose-600"}`}>
            {salasFeedback}
          </span>
        ) : null}
      </div>

      <SchedulerBoard
        diasSemana={DIAS_SEMANA}
        tempos={horariosDisponiveis}
        aulas={aulas}
        onSalvar={handleSalvar}
        grid={grid}
        onGridChange={setGrid}
        slotLookup={slotLookup}
        existingAssignments={existingAssignments}
        conflictSlots={conflictSlots}
        salas={salas}
        onSalaChange={(aulaId, salaId) => {
          setAulas((prev) => prev.map((aula) => (aula.id === aulaId ? { ...aula, salaId } : aula)));
        }}
      />
    </div>
  );
}
