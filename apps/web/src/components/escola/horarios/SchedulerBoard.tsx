"use client";

import React, { useCallback, useEffect, useMemo, useState, useId } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { AlertOctagon, Check, GripVertical, Save, Wand2 } from "lucide-react";

export type SchedulerSlot = {
  id: string;
  label: string;
  tipo: "aula" | "intervalo";
};

export type SchedulerAula = {
  id: string;
  disciplina: string;
  sigla: string;
  professor: string;
  professorId?: string | null;
  salaId?: string | null;
  cor: string;
  temposTotal: number;
  temposAlocados: number;
  conflito?: boolean;
};

type SchedulerBoardProps = {
  diasSemana?: string[];
  tempos?: SchedulerSlot[];
  aulas?: SchedulerAula[];
  grid?: Record<string, string | null>;
  onGridChange?: (grid: Record<string, string | null>) => void;
  onSalvar?: (grid: Record<string, string | null>) => void;
  onAutoCompletar?: () => void;
  slotLookup?: Record<string, string>;
  existingAssignments?: Array<{
    slot_id: string;
    professor_id: string | null;
    sala_id?: string | null;
  }>;
  conflictSlots?: Record<string, boolean>;
  salas?: Array<{ id: string; nome: string }>;
  onSalaChange?: (aulaId: string, salaId: string | null) => void;
};

const DEFAULT_DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const DEFAULT_TEMPOS: SchedulerSlot[] = [
  { id: "t1", label: "07:30 - 08:15", tipo: "aula" },
  { id: "t2", label: "08:20 - 09:05", tipo: "aula" },
  { id: "int", label: "Intervalo", tipo: "intervalo" },
  { id: "t3", label: "09:25 - 10:10", tipo: "aula" },
  { id: "t4", label: "10:15 - 11:00", tipo: "aula" },
];

const DEFAULT_AULAS: SchedulerAula[] = [
  {
    id: "mat",
    disciplina: "Matemática",
    sigla: "MAT",
    professor: "Prof. João",
    cor: "bg-blue-100 border-blue-300 text-blue-800",
    temposTotal: 5,
    temposAlocados: 0,
  },
  {
    id: "por",
    disciplina: "Língua Portuguesa",
    sigla: "LPL",
    professor: "Prof. Maria",
    cor: "bg-emerald-100 border-emerald-300 text-emerald-800",
    temposTotal: 4,
    temposAlocados: 0,
  },
  {
    id: "fis",
    disciplina: "Física",
    sigla: "FIS",
    professor: "Prof. Alberto",
    cor: "bg-amber-100 border-amber-300 text-amber-800",
    temposTotal: 2,
    temposAlocados: 0,
  },
];

type GridState = Record<string, string | null>;

export function SchedulerBoard({
  diasSemana = DEFAULT_DIAS,
  tempos = DEFAULT_TEMPOS,
  aulas = DEFAULT_AULAS,
  grid: controlledGrid,
  onGridChange,
  onSalvar,
  onAutoCompletar,
  slotLookup,
  existingAssignments,
  conflictSlots,
  salas,
  onSalaChange,
}: SchedulerBoardProps) {
  const [grid, setGrid] = useState<GridState>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [estoque, setEstoque] = useState(aulas);

  useEffect(() => {
    if (controlledGrid) {
      setGrid(controlledGrid);
    }
  }, [controlledGrid]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const slotId = over.id as string;
    const baseId = (active.data?.current as { baseId?: string } | undefined)?.baseId;
    if (!baseId) return;

    const nextGrid = {
      ...(controlledGrid ?? grid),
      [slotId]: baseId,
    };
    setGrid(nextGrid);
    onGridChange?.(nextGrid);

    setEstoque((prev) =>
      prev.map((a) =>
        a.id === baseId
          ? { ...a, temposAlocados: Math.min(a.temposTotal, a.temposAlocados + 1) }
          : a
      )
    );
  };

  const getAulaById = useCallback(
    (baseId: string) => estoque.find((a) => a.id === baseId),
    [estoque]
  );

  const detectedConflicts = useMemo(() => {
    if (!slotLookup || !existingAssignments || existingAssignments.length === 0) return new Set<string>();
    const conflictSet = new Set<string>();
    const gridEntries = Object.entries(controlledGrid ?? grid);
    for (const [slotKey, disciplinaId] of gridEntries) {
      if (!disciplinaId) continue;
      const slotId = slotLookup[slotKey];
      if (!slotId) continue;
      const aula = getAulaById(disciplinaId);
      if (!aula) continue;
      const hasProfessorConflict = aula.professorId
        ? existingAssignments.some(
            (assign) => assign.slot_id === slotId && assign.professor_id === aula.professorId
          )
        : false;
      const hasSalaConflict = aula.salaId
        ? existingAssignments.some((assign) => assign.slot_id === slotId && assign.sala_id === aula.salaId)
        : false;
      if (hasProfessorConflict || hasSalaConflict) conflictSet.add(slotKey);
    }
    return conflictSet;
  }, [controlledGrid, existingAssignments, grid, slotLookup, getAulaById]);

  const overlay = useMemo(() => {
    if (!activeId) return null;
    return (
      <div className="w-32 h-20 bg-slate-900 text-white rounded-lg shadow-2xl p-3 opacity-90 rotate-3 cursor-grabbing border-2 border-emerald-400">
        <span className="font-bold">Alocando...</span>
      </div>
    );
  }, [activeId]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full bg-slate-50 overflow-hidden">
        <div className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col shadow-xl z-10">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Distribuir Aulas</h2>
            <p className="text-xs text-slate-500">Turma selecionada</p>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 pr-2">
            {estoque.map((aula) => (
              <DraggableSource
                key={aula.id}
                aula={aula}
                salas={salas}
                onSalaChange={onSalaChange}
              />
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
            <button
              type="button"
              onClick={onAutoCompletar}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition-all group"
            >
              <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Auto-Completar (IA)
            </button>
            <button
              type="button"
              onClick={() => onSalvar?.(grid)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all"
            >
              <Save className="w-4 h-4" />
              Salvar Quadro
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-w-[800px]">
            <div className="grid grid-cols-6 border-b border-slate-200">
              <div className="p-4 bg-slate-100 border-r border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider text-center flex items-center justify-center">
                Horário
              </div>
              {diasSemana.map((dia) => (
                <div
                  key={dia}
                  className="p-4 font-bold text-slate-700 text-center border-r border-slate-200 last:border-r-0 bg-slate-50"
                >
                  {dia}
                </div>
              ))}
            </div>

            {tempos.map((tempo) => (
              <div key={tempo.id} className="grid grid-cols-6 border-b border-slate-200 last:border-b-0 min-h-[100px]">
                <div className="p-3 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-center items-center text-xs">
                  <span className="font-bold text-slate-900 block mb-1">{tempo.label}</span>
                  {tempo.tipo === "intervalo" ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px]">
                      RECREIO
                    </span>
                  ) : null}
                </div>

                {tempo.tipo === "intervalo" ? (
                  <div className="col-span-5 bg-amber-50/30 flex items-center justify-center text-amber-300 font-black text-4xl tracking-[1em] opacity-20 select-none">
                    I N T E R V A L O
                  </div>
                ) : (
                  diasSemana.map((dia) => {
                    const slotId = `${dia}-${tempo.id}`;
                    const aulaAlocadaId = grid[slotId];
                    const aula = aulaAlocadaId ? getAulaById(aulaAlocadaId) : null;
                    const hasConflict = Boolean(conflictSlots?.[slotId]) || detectedConflicts.has(slotId);

                    return (
                      <DroppableSlot key={slotId} id={slotId} hasConflict={hasConflict}>
                        {aula ? (
                          <div
                            className={`h-full w-full rounded-lg p-2 border-l-4 shadow-sm flex flex-col justify-between cursor-grab active:cursor-grabbing ${aula.cor}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-sm">{aula.sigla}</span>
                              {hasConflict || aula.conflito ? (
                                <AlertOctagon className="w-4 h-4 text-rose-600 animate-pulse" />
                              ) : null}
                            </div>
                            <div className="text-[10px] opacity-80 font-medium truncate">
                              {aula.professor}
                            </div>
                          </div>
                        ) : null}
                      </DroppableSlot>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>{overlay}</DragOverlay>
      </div>
    </DndContext>
  );
}

const DraggableSource = ({
  aula,
  salas,
  onSalaChange,
}: {
  aula: SchedulerAula;
  salas?: Array<{ id: string; nome: string }>;
  onSalaChange?: (aulaId: string, salaId: string | null) => void;
}) => {
  const id = useId();
  const uniqueId = `${aula.id}-${id}`;
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: uniqueId,
    data: { baseId: aula.id },
  });

  const isComplete = aula.temposAlocados >= aula.temposTotal;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-xl border-2 transition-all select-none ${
        isComplete
          ? "bg-slate-50 border-slate-100 opacity-50 grayscale"
          : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${aula.cor.split(" ")[0]}`} />
          <span className="font-bold text-sm text-slate-800">{aula.disciplina}</span>
        </div>
        {isComplete ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <button type="button" className="text-slate-300" {...listeners} {...attributes}>
            <GripVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex justify-between items-end">
        <span className="text-xs text-slate-500 truncate w-24">{aula.professor}</span>
        <div className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
          {aula.temposAlocados}/{aula.temposTotal}
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${isComplete ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${(aula.temposAlocados / aula.temposTotal) * 100}%` }}
        />
      </div>

      {salas && salas.length > 0 ? (
        <div className="mt-3">
          <label className="text-[10px] uppercase text-slate-400 font-semibold">Sala</label>
          <select
            value={aula.salaId ?? ""}
            onChange={(event) => onSalaChange?.(aula.id, event.target.value || null)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="">Sem sala</option>
            {salas.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
};

const DroppableSlot = ({
  id,
  children,
  hasConflict,
}: {
  id: string;
  children: React.ReactNode;
  hasConflict?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`p-1 border-r border-slate-200 transition-colors h-full min-h-[100px] flex flex-col justify-center ${
        isOver ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400" : "hover:bg-slate-50"
      } ${hasConflict ? "bg-rose-50 ring-2 ring-rose-400" : ""} ${!children && !isOver ? "bg-stripes-slate" : ""}`}
    >
      {children || (
        <div className="h-full w-full border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-xs font-bold text-slate-300 uppercase">Vazio</span>
        </div>
      )}
    </div>
  );
};
