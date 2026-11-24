"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { AlertOctagon, Check, GripVertical, Save, Wand2, Trash2, Pencil, Plus } from "lucide-react"; // Adicionei Trash se precisar limpar

// --- TYPES ---
export type SchedulerSlot = {
  id: string;
  labelDefault: string;
  tipo: "aula" | "intervalo";
  horariosPorDia?: Record<string, string>;
};

export type SchedulerAula = {
  id: string;
  cursoMatrizId?: string | null;
  disciplina: string;
  sigla: string;
  professor: string;
  professorId?: string | null;
  salaId?: string | null;
  cor: string;
  temposTotal: number;
  temposAlocados: number;
  conflito?: boolean;
  missingLoad?: boolean;
};

type SchedulerBoardProps = {
  diasSemana?: string[];
  tempos?: SchedulerSlot[];
  aulas?: SchedulerAula[];
  grid?: Record<string, string | null>;
  onGridChange?: (grid: Record<string, string | null>) => void;
  onSalvar?: (grid: Record<string, string | null>) => void;
  onAutoCompletar?: () => void;
  autoCompleting?: boolean;
  slotLookup?: Record<string, string>;
  existingAssignments?: Array<{
    slot_id: string;
    professor_id: string | null;
    sala_id?: string | null;
  }>;
  conflictSlots?: Record<string, boolean>;
  conflictReasons?: Record<string, string[]>;
  salas?: Array<{ id: string; nome: string }>;
  professores?: Array<{ id: string; nome: string }>;
  onAssignProfessor?: (aula: SchedulerAula, professorUserId: string) => Promise<boolean | void> | boolean | void;
  turmaSala?: string | null;
  onAssignTurmaSala?: (salaId: string) => Promise<boolean | void> | boolean | void;
  onAutoConfigurarCargas?: () => void;
  autoConfiguring?: boolean;
  onPublicar?: (grid: Record<string, string | null>) => void;
  canPublicar?: boolean;
  publishDisabledReason?: string;
  publishing?: boolean;
  busy?: boolean;
};

// --- COMPONENT ---
export function SchedulerBoard({
  diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
  tempos,
  aulas,
  grid: controlledGrid,
  onGridChange,
  onSalvar,
  onAutoCompletar,
  autoCompleting,
  slotLookup,
  existingAssignments = [],
  conflictSlots: externalConflictSlots,
  conflictReasons,
  salas,
  professores,
  onAssignProfessor,
  turmaSala,
  onAssignTurmaSala,
  onPublicar,
  canPublicar = true,
  publishDisabledReason,
  publishing,
  busy = false,
}: SchedulerBoardProps) {
  const [grid, setGrid] = useState<Record<string, string | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [assigningProfessor, setAssigningProfessor] = useState<SchedulerAula | null>(null);
  const [assigningTurmaSala, setAssigningTurmaSala] = useState(false);
  const currentGrid = controlledGrid ?? grid;

  // Sincroniza grid externo
  useEffect(() => {
    if (controlledGrid) setGrid(controlledGrid);
  }, [controlledGrid]);

  const estoque = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const value of Object.values(currentGrid)) {
      if (!value) continue;
      counts[value] = (counts[value] || 0) + 1;
    }

    return (aulas || []).map((aula) => (
      aula.temposAlocados === (counts[aula.id] ?? 0)
        ? aula
        : { ...aula, temposAlocados: counts[aula.id] ?? 0 }
    ));
  }, [aulas, currentGrid]);

  const aulaById = useMemo(() => new Map(estoque.map((aula) => [aula.id, aula])), [estoque]);

  // existingAssignments contains this turma's saved version, not other turmas.
  // Cross-turma conflicts are checked by the server when publishing.
  const conflictSlots = externalConflictSlots ?? {};
  const conflictCount = Object.values(conflictSlots).filter(Boolean).length;

  // --- DND HANDLERS (Otimizados) ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const baseId = event.active.data.current?.baseId as string | undefined;
    setActiveId(baseId ?? (event.active.id as string));
  }, []);

  const updateGrid = useCallback((nextGrid: Record<string, string | null>) => {
    setGrid(nextGrid);
    onGridChange?.(nextGrid);
  }, [onGridChange]);

  const handleSelectSlot = useCallback((slotKey: string, disciplinaId: string | null) => {
    if (busy || !slotLookup?.[slotKey] || (disciplinaId && !aulaById.has(disciplinaId))) return;
    updateGrid({ ...currentGrid, [slotKey]: disciplinaId });
  }, [aulaById, busy, currentGrid, slotLookup, updateGrid]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    const target = over?.id as string | undefined;
    const baseId = active.data.current?.baseId as string | undefined;
    const source = active.data.current?.sourceSlot as string | undefined;
    // A cancelled drop must never remove an existing lesson.
    if (busy || !target || !baseId || !aulaById.has(baseId) || source === target) return;
    if (target !== "trash" && !slotLookup?.[target]) return;
    if (source && !slotLookup?.[source]) return;
    const next = { ...currentGrid };
    if (target === "trash") {
      if (!source) return;
      next[source] = null;
    } else {
      if (source) next[source] = currentGrid[target] ?? null;
      next[target] = baseId;
    }
    updateGrid(next);
  }, [aulaById, busy, currentGrid, slotLookup, updateGrid]);

  const getAulaById = useCallback((id: string) => aulaById.get(id), [aulaById]);

  const effectiveTurmaSala = useMemo(() => {
    if (turmaSala) return turmaSala;
    const salaId = existingAssignments?.find((item) => item.sala_id)?.sala_id ?? null;
    if (!salaId) return null;
    const sala = (salas || []).find((item) => item.id === salaId);
    return sala?.nome ?? null;
  }, [turmaSala, existingAssignments, salas]);

  const shouldShowTurmaSalaWarning = useMemo(() => {
    if (effectiveTurmaSala || !onAssignTurmaSala) return false;
    return Object.values(currentGrid).some((value) => Boolean(value));
  }, [effectiveTurmaSala, onAssignTurmaSala, currentGrid]);

  // --- RENDERING ---
  const overlayItem = useMemo(() => {
    if (!activeId) return null;
    const aula = estoque.find((a) => activeId.startsWith(a.id));
    if (!aula) return null;

    return (
      <div className="w-40 h-24 rounded-xl shadow-xl p-3 rotate-3 cursor-grabbing bg-klasse-dark text-white border border-klasse-gold/50 flex flex-col justify-center items-center">
        <span className="font-sora font-bold text-lg">{aula.sigla}</span>
        <span className="text-xs text-muted-foreground">Alocando...</span>
      </div>
    );
  }, [activeId, estoque]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <fieldset disabled={busy} aria-busy={busy} className="min-w-0 flex flex-col lg:flex-row h-full min-h-[600px] bg-muted font-sora rounded-xl border border-border overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-full lg:w-72 lg:shrink-0 bg-card border-b lg:border-b-0 lg:border-r border-border p-4 flex flex-col z-10">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground tracking-tight">Disciplinas</h2>
            <p className="text-xs text-muted-foreground">Arraste uma disciplina ou seleccione-a directamente no tempo.</p>
          </div>

          <StatusAlerts
            conflictCount={conflictCount}
            shouldShowTurmaSalaWarning={shouldShowTurmaSalaWarning && Boolean(onAssignTurmaSala)}
            onSetAssigningTurmaSala={() => { if (!busy) setAssigningTurmaSala(true); }}
          />

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 max-h-64 lg:max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
            {estoque.map((aula) => (
              <DraggableSource key={aula.id} aula={aula} />
            ))}
          </div>

          <TrashDropzone active={Boolean(activeId)} />

          <ActionButtons
            onAutoCompletar={onAutoCompletar}
            autoCompleting={autoCompleting}
            onSalvar={() => onSalvar?.(currentGrid)}
            onPublicar={onPublicar}
            canPublicar={canPublicar}
            publishDisabledReason={publishDisabledReason}
            publishing={publishing}
            busy={busy}
            grid={currentGrid}
          />
        </div>

        {/* GRID */}
        <div className="min-w-0 flex-1 p-3 overflow-auto bg-muted/50">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden min-w-[800px]">
            <GridHeader diasSemana={diasSemana} />
            {tempos?.map((tempo) => (
              <GridRow
                key={tempo.id}
                tempo={tempo}
                diasSemana={diasSemana}
                grid={currentGrid}
                conflictSlots={conflictSlots}
                conflictReasons={conflictReasons}
                getAulaById={getAulaById}
                aulas={estoque}
                slotLookup={slotLookup}
                onSelectSlot={handleSelectSlot}
                editingSlot={editingSlot}
                setEditingSlot={setEditingSlot}
                onAssignProfessor={busy ? undefined : onAssignProfessor}
                setAssigningProfessor={setAssigningProfessor}
                effectiveTurmaSala={effectiveTurmaSala}
                salas={salas}
              />
            ))}
          </div>
        </div>

        <DragOverlay>{overlayItem}</DragOverlay>
      </fieldset>

      {assigningProfessor && (
        <AssignProfessorModal
          aula={assigningProfessor}
          professores={professores || []}
          onClose={() => setAssigningProfessor(null)}
          onAssign={async (professorId) => {
            if (!onAssignProfessor) return;
            if (await onAssignProfessor(assigningProfessor, professorId) !== false) setAssigningProfessor(null);
          }}
        />
      )}
      {assigningTurmaSala && (
        <AssignTurmaSalaModal
          salas={salas || []}
          onClose={() => setAssigningTurmaSala(false)}
          onAssign={async (salaId) => {
            if (!onAssignTurmaSala) return;
            if (await onAssignTurmaSala(salaId) !== false) setAssigningTurmaSala(false);
          }}
        />
      )}
    </DndContext>
  );
}

// --- OPTIMIZED SUB-COMPONENTS ---

const StatusAlerts = React.memo(({
  conflictCount,
  shouldShowTurmaSalaWarning,
  onSetAssigningTurmaSala
}: any) => (
  <>
    {conflictCount > 0 && (
      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
        <div className="font-semibold">{conflictCount} conflito(s) no quadro.</div>
        <div className="mt-1">Revise os slots destacados antes de publicar.</div>
      </div>
    )}
    {shouldShowTurmaSalaWarning && (
      <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-xs text-foreground">
        <div className="font-semibold">Turma sem sala definida.</div>
        <div className="mt-1">Pode definir a sala padrão agora ou mais tarde.</div>
        <button
          type="button"
          onClick={onSetAssigningTurmaSala}
          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
        >
          Definir sala
        </button>
      </div>
    )}
  </>
));
StatusAlerts.displayName = "StatusAlerts";

const ActionButtons = React.memo(({
  onAutoCompletar,
  autoCompleting,
  onSalvar,
  onPublicar,
  canPublicar,
  publishDisabledReason,
  publishing,
  busy,
  grid
}: any) => (
  <div className="mt-6 pt-6 border-t border-border space-y-3">
    <button
      type="button"
      onClick={onAutoCompletar}
      disabled={autoCompleting || busy}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber text-white text-sm font-bold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Wand2 className="w-4 h-4" />
      {autoCompleting ? "A gerar proposta..." : "Preencher tempos livres"}
    </button>
    <button
      type="button"
      onClick={onSalvar}
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-bold hover:bg-muted active:scale-[0.98] transition-all"
    >
      <Save className="w-4 h-4" />
      Guardar rascunho
    </button>
    {onPublicar && (
      <button
        type="button"
        onClick={() => onPublicar(grid)}
        disabled={!canPublicar || publishing || busy}
        title={!canPublicar ? publishDisabledReason : undefined}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-klasse-gold text-klasse-gold-900 text-sm font-bold shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Check className="w-4 h-4" />
        {publishing ? "A publicar..." : "Publicar horário"}
      </button>
    )}
  </div>
));
ActionButtons.displayName = "ActionButtons";

const GridHeader = React.memo(({ diasSemana }: { diasSemana: string[] }) => (
  <div className="grid grid-cols-6 border-b border-border bg-muted">
    <div className="p-3 border-r border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center flex items-center justify-center">
      Horário
    </div>
    {diasSemana.map((dia) => (
      <div key={dia} className="p-3 text-sm font-bold text-foreground text-center border-r border-border last:border-r-0">
        {dia}
      </div>
    ))}
  </div>
));
GridHeader.displayName = "GridHeader";

const GridRow = React.memo(({
  tempo,
  diasSemana,
  grid,
  conflictSlots,
  conflictReasons,
  getAulaById,
  aulas,
  slotLookup,
  onSelectSlot,
  editingSlot,
  setEditingSlot,
  onAssignProfessor,
  setAssigningProfessor,
  effectiveTurmaSala,
  salas,
}: any) => {
  const defaultRange = tempo.labelDefault.split(" - ");
  const horarios = tempo.horariosPorDia || {};
  const uniqueRanges = Array.from(new Set(Object.values(horarios)));
  const hasDifferentTimes = uniqueRanges.length > 1;

  return (
    <div className="grid grid-cols-6 border-b border-border last:border-b-0 min-h-[110px]">
      <div className="p-2 border-r border-border bg-muted/30 flex flex-col justify-center items-center text-xs">
        <span className="font-bold text-foreground mb-1">{defaultRange[0] || "—"}</span>
        <span className="text-muted-foreground text-[10px]">{defaultRange[1] || ""}</span>
        {hasDifferentTimes && (
          <span className="mt-1 text-[9px] font-semibold text-amber-600">Horário varia</span>
        )}
        {tempo.tipo === "intervalo" && (
          <span className="mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[9px] uppercase tracking-wide">
            Intervalo
          </span>
        )}
      </div>

      {tempo.tipo === "intervalo" ? (
        <div className="col-span-5 bg-stripes-gray flex items-center justify-center">
          <span className="text-muted-foreground/50 font-black text-4xl tracking-[1.5em] opacity-40 select-none uppercase">
            Recreio
          </span>
        </div>
      ) : (
        diasSemana.map((dia: string) => (
          <GridCell
            key={`${dia}-${tempo.id}`}
            dia={dia}
            tempoId={tempo.id}
            horarioDia={horarios[dia] || tempo.labelDefault}
            aulaId={grid[`${dia}-${tempo.id}`]}
            hasConflict={Boolean(conflictSlots?.[`${dia}-${tempo.id}`])}
            conflictReason={conflictReasons?.[`${dia}-${tempo.id}`]}
            getAulaById={getAulaById}
            aulas={aulas}
            slotAvailable={Boolean(slotLookup?.[`${dia}-${tempo.id}`])}
            onSelectSlot={onSelectSlot}
            editingSlot={editingSlot}
            setEditingSlot={setEditingSlot}
            onAssignProfessor={onAssignProfessor}
            setAssigningProfessor={setAssigningProfessor}
            effectiveTurmaSala={effectiveTurmaSala}
            salas={salas}
          />
        ))
      )}
    </div>
  );
});
GridRow.displayName = "GridRow";

const GridCell = React.memo(({
  dia,
  tempoId,
  horarioDia,
  aulaId,
  hasConflict,
  conflictReason,
  getAulaById,
  aulas,
  slotAvailable,
  onSelectSlot,
  editingSlot,
  setEditingSlot,
  onAssignProfessor,
  setAssigningProfessor,
  effectiveTurmaSala,
  salas
}: any) => {
  const slotId = `${dia}-${tempoId}`;
  const aula = aulaId ? getAulaById(aulaId) : null;
  if (!slotAvailable) return <div className="border-r border-border bg-muted/40 p-2 text-xs text-muted-foreground">Sem tempo</div>;

  return (
    <DroppableSlot id={slotId} hasConflict={hasConflict} isFilled={!!aula}>
      {aula ? (
        <DraggableGridItem slotId={slotId} aula={aula}>
          <AulaCard
            aula={aula}
            hasConflict={hasConflict}
            conflictReason={conflictReason}
            horarioDia={horarioDia}
            onAssignProfessor={onAssignProfessor}
            setAssigningProfessor={setAssigningProfessor}
            effectiveTurmaSala={effectiveTurmaSala}
            salas={salas}
          />
        </DraggableGridItem>
      ) : null}
      {editingSlot === slotId ? <select
        autoFocus
        onBlur={() => setEditingSlot(null)}
        onKeyDown={(event) => { if (event.key === "Escape") setEditingSlot(null); }}
        aria-label={`${dia}, ${horarioDia}: disciplina`}
        value={aulaId ?? ""}
        onChange={(event) => { onSelectSlot(slotId, event.target.value || null); setEditingSlot(null); }}
        className="mt-1 w-full min-w-0 rounded-xl border border-border bg-card p-1.5 text-xs text-foreground focus:ring-4 focus:ring-klasse-gold/20"
      >
        <option value="">Tempo livre</option>
        {(aulas as SchedulerAula[]).map((item) => <option key={item.id} value={item.id}>{item.disciplina}</option>)}
      </select> : <button type="button" onClick={()=>setEditingSlot(slotId)} aria-label={`${aula ? "Editar" : "Adicionar"} disciplina: ${dia}, ${horarioDia}`} className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:border-klasse-gold hover:text-foreground">{aula?<Pencil size={14}/>:<Plus size={14}/>} {aula?"Editar":"Adicionar disciplina"}</button>}
    </DroppableSlot>
  );
});
GridCell.displayName = "GridCell";

const AulaCard = React.memo(({
  aula,
  hasConflict,
  conflictReason,
  horarioDia,
  onAssignProfessor,
  setAssigningProfessor,
  effectiveTurmaSala,
  salas
}: any) => {
  const getSalaLabel = () => {
    if (!effectiveTurmaSala) return null;
    const sala = (salas || []).find((item: any) => item.nome === effectiveTurmaSala);
    return sala?.nome ?? effectiveTurmaSala;
  };

  return (
    <div className={`
      group h-full w-full rounded-lg p-2.5 border border-transparent shadow-sm 
      flex flex-col justify-between cursor-grab active:cursor-grabbing hover:brightness-95 transition-all
      ${aula.cor}
    `} title={conflictReason?.length ? conflictReason.join(" · ") : undefined}>
      <div className="flex justify-between items-start">
        <span className="font-semibold text-sm leading-tight">{aula.disciplina}</span>
        {(hasConflict || aula.conflito) && (
          <AlertOctagon className="w-4 h-4 text-rose-600 animate-pulse" />
        )}
      </div>
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{horarioDia}</div>
        {aula.professorId ? (
          <div className="text-[10px] font-medium opacity-80 truncate leading-tight">
            {aula.professor.split(" ")[0]}
          </div>
        ) : (
          <div className="text-[10px] font-medium opacity-70 truncate leading-tight">
            A definir
          </div>
        )}
        {!aula.professorId && onAssignProfessor ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setAssigningProfessor(aula);
            }}
            className="text-xs font-semibold underline text-foreground"
          >
            Atribuir professor
          </button>
        ) : null}
        {effectiveTurmaSala ? (
          <div className="inline-block px-1.5 py-0.5 bg-card/50 rounded text-[9px] font-bold">
            {getSalaLabel()}
          </div>
        ) : null}
      </div>
    </div>
  );
});
AulaCard.displayName = "AulaCard";

// --- DnD & MODAL COMPONENTS ---

const DraggableSource = React.memo(({ aula }: { aula: SchedulerAula }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${aula.id}`,
    data: { baseId: aula.id },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`rounded-xl border border-border bg-card p-3 select-none cursor-grab active:cursor-grabbing hover:border-klasse-gold/50 ${isDragging ? "opacity-30" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{aula.disciplina}</span>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{aula.temposAlocados} tempo(s) programado(s)</p>
    </div>
  );

});
DraggableSource.displayName = "DraggableSource";

const DraggableGridItem = ({ slotId, aula, children }: any) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid-${slotId}`,
    data: { baseId: aula.id, sourceSlot: slotId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-40" : "h-full w-full"}
    >
      {children}
    </div>
  );
};

const DroppableSlot = ({ id, children, hasConflict, isFilled }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        p-1 border-r border-border transition-all h-full min-h-[110px] flex flex-col
        ${isOver && !isFilled ? "bg-amber/5 ring-2 ring-inset ring-amber/30" : ""}
        ${hasConflict ? "bg-rose-50 ring-2 ring-inset ring-rose-200" : ""}
        ${!children && !isOver ? "hover:bg-muted" : ""}
      `}
    >
      {children || (
        <div className={`
            h-full w-full rounded-lg border-2 border-dashed flex items-center justify-center transition-all
            ${isOver ? "border-amber/40 bg-card" : "border-transparent opacity-0 hover:opacity-100 hover:border-border"}
        `}>
          {isOver && <span className="text-[10px] font-bold text-amber uppercase">Soltar</span>}
          {!isOver && <span className="text-[10px] font-bold text-muted-foreground uppercase">Vazio</span>}
        </div>
      )}
    </div>
  );
};

const TrashDropzone = ({ active }: { active: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: "trash" });
  const highlight = isOver || active;

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wide text-center transition-all ${
        highlight
          ? "border-rose-400 bg-rose-50 text-rose-700"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      Arraste aqui para remover
    </div>
  );
};

type ResourceOption = {id:string;nome:string};
function ResourceAssignmentDialog({title,description,options,placeholder,onClose,onAssign}:{
  title:string;description:string;options:ResourceOption[];placeholder:string;
  onClose:()=>void;onAssign:(id:string)=>void|Promise<void>;
}){
  const [selected,setSelected]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const submit=async()=>{
    if(!selected||saving)return;
    setSaving(true);setError(null);
    try{await onAssign(selected);}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível guardar a atribuição.");}
    finally{setSaving(false);}
  };
  return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose()}}>
    <DialogContent closeButton={!saving} onInteractOutside={e=>e.preventDefault()} className="rounded-xl border-border bg-card">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <label className="text-sm font-medium">{placeholder}
        <select value={selected} disabled={saving} onChange={e=>setSelected(e.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
          <option value="">{placeholder}</option>
          {options.map(option=><option key={option.id} value={option.id}>{option.nome}</option>)}
        </select>
      </label>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button tone="gold" loading={saving} disabled={!selected} onClick={()=>void submit()}> {saving?"A guardar…":"Guardar"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

const AssignProfessorModal = ({aula,professores,onClose,onAssign}:{
  aula:SchedulerAula;professores:ResourceOption[];onClose:()=>void;onAssign:(id:string)=>void|Promise<void>;
}) => <ResourceAssignmentDialog title="Atribuir professor" description={aula.disciplina} options={professores} placeholder="Seleccione um professor" onClose={onClose} onAssign={onAssign}/>;

const AssignTurmaSalaModal = ({salas,onClose,onAssign}:{
  salas:ResourceOption[];onClose:()=>void;onAssign:(id:string)=>void|Promise<void>;
}) => <ResourceAssignmentDialog title="Definir sala da turma" description="Sala padrão do quadro de horários." options={salas} placeholder="Seleccione uma sala" onClose={onClose} onAssign={onAssign}/>;
