"use client";
import { Suspense } from "react";
import { HorarioEditor } from "@/components/escola/horarios/HorarioEditor";
import { HorarioDataProvider } from "@/components/escola/horarios/HorarioDataProvider";
import type { TurmaItem } from "~/types/turmas";

interface TurmaHorarioModalProps {
  turma: TurmaItem;
  escolaId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

// One editor for both entry points; no independent timetable writes here.
export default function TurmaHorarioModal({turma,escolaId,isOpen,onClose,onUpdated}:TurmaHorarioModalProps) {
  if (!isOpen) return null;
  return <Suspense fallback={null}>
    <HorarioDataProvider key={escolaId} escolaId={escolaId}>
      <HorarioEditor key={turma.id} escolaId={escolaId} initialTurmaId={turma.id} onClose={onClose} onUpdated={onUpdated}/>
    </HorarioDataProvider>
  </Suspense>;
}
