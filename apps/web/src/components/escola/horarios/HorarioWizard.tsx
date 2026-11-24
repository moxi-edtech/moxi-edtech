"use client";
import { useState } from "react";
import { Clock, School, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StepSalas } from "./wizard/StepSalas";
import { StepSlots } from "./wizard/StepSlots";

interface HorarioWizardProps {
  escolaId: string;
  onFinish?: () => void;
  initialStep?: number;
  initialTurno?: string | null;
  embedded?: boolean;
  onBusyChange?: (busy:boolean)=>void;
}

// Configuration is a workspace, not a mandatory sequence. Rooms are optional.
export function HorarioWizard({escolaId,onFinish,initialStep=1,initialTurno,embedded=false,onBusyChange}:HorarioWizardProps){
  const [tab,setTab]=useState(initialStep===0?"salas":"tempos");
  const [busy,setBusy]=useState(false);
  const notifyBusy=(value:boolean)=>{setBusy(value);onBusyChange?.(value)};
  return <section className={embedded?"font-sora":"rounded-xl border border-border bg-card p-5 md:p-6 font-sora"}>
    {!embedded&&<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-klasse-green">Configurar tempos e salas</h1><p className="text-sm text-muted-foreground">Os tempos são partilhados pelas turmas do turno. As salas são opcionais.</p></div>
      <Button variant="outline" onClick={onFinish} disabled={busy} className="gap-2"><ArrowLeft size={16}/> Voltar aos horários</Button>
    </div>}
    <div role="tablist" aria-label="Configuração" className="mb-5 flex gap-2 border-b border-border pb-3">
      <button type="button" role="tab" aria-selected={tab==="tempos"} disabled={busy} onClick={()=>setTab("tempos")} className={"inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold "+(tab==="tempos"?"bg-klasse-gold/15 text-foreground":"text-muted-foreground")}><Clock size={16}/> Tempos dos turnos</button>
      <button type="button" role="tab" aria-selected={tab==="salas"} disabled={busy} onClick={()=>setTab("salas")} className={"inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold "+(tab==="salas"?"bg-klasse-gold/15 text-foreground":"text-muted-foreground")}><School size={16}/> Salas (opcional)</button>
    </div>
    <div role="tabpanel">{tab==="tempos"?<StepSlots escolaId={escolaId} initialTurno={initialTurno} onBusyChange={notifyBusy} onComplete={()=>onFinish?.()}/>:<StepSalas escolaId={escolaId} onBusyChange={notifyBusy} onComplete={()=>setTab("tempos")}/>}</div>
  </section>;
}
