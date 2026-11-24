"use client";
import { Suspense } from "react";
import { HorarioEditor } from "@/components/escola/horarios/HorarioEditor";
import { Spinner } from "@/components/ui/Spinner";

export default function QuadroHorariosPage() {
  return <Suspense fallback={<div className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground"><Spinner size={24}/> A carregar horários…</div>}>
    <HorarioEditor/>
  </Suspense>;
}
