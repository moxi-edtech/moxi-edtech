"use client";
import dynamic from "next/dynamic";
import {useEffect,useRef,useState} from "react";
import {CalendarCheck} from "lucide-react";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import {Button} from "@/components/ui/Button";
import {ModalShell} from "@/components/ui/ModalShell";
import type {ExpedienteCloseGuard} from "@/components/secretaria/ExpedienteWorkspace";

const Workspace=dynamic(()=>import("@/components/secretaria/ExpedienteWorkspace"),{
 loading:()=> <div role="status" className="animate-pulse space-y-3"><div className="h-24 rounded-xl bg-muted"/><div className="h-40 rounded-xl bg-muted"/><span className="sr-only">A carregar expediente...</span></div>,
});
type Summary={closed:null|{closed_at:string;operation_count:number};cashStatus:string|null;pendingCount:number|null;rejectedCount:number;canClose:boolean};
export default function ExpedienteDashboardCard({escolaId,portal}:{escolaId:string;portal:"secretaria"|"admin"|"operacoes"}){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [open,setOpen]=useState(false);
 const [initialHistory,setInitialHistory]=useState(false);
 const [refreshVersion,setRefreshVersion]=useState(0);
 const [closeWarning,setCloseWarning]=useState<"busy"|"draft"|null>(null);
 const closeGuardRef=useRef<ExpedienteCloseGuard|null>(null);
 const triggerRef=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
   let active=true;let last=0;let inFlight=false;const controller=new AbortController();
   const refresh=()=>{if(inFlight||Date.now()-last<15000)return;last=Date.now();inFlight=true;fetch("/api/escola/"+encodeURIComponent(escolaId)+"/expediente?view=summary"+(portal==="secretaria"?"":"&scope=supervision"),{cache:"no-store",signal:controller.signal}).then(async r=>{const body=await r.json();if(active&&r.ok&&body.ok)setSummary(body);}).catch(()=>{}).finally(()=>{inFlight=false;});};
   refresh();window.addEventListener("focus",refresh);
   return()=>{active=false;controller.abort();window.removeEventListener("focus",refresh);};
 },[escolaId,portal,refreshVersion]);
 useEffect(()=>{setSummary(null);setOpen(false);setCloseWarning(null);},[escolaId,portal]);
 function openWorkspace(){setInitialHistory(portal!=="secretaria"||Boolean(summary?.rejectedCount));setCloseWarning(null);setOpen(true);}
 function closeWorkspace(discard=false){
   const state=closeGuardRef.current?.()??null;
   if(state==="busy"){setCloseWarning("busy");return;}
   if(state==="draft"&&!discard){setCloseWarning("draft");return;}
   setCloseWarning(null);setOpen(false);setRefreshVersion(v=>v+1);
   window.requestAnimationFrame(()=>triggerRef.current?.focus({preventScroll:true}));
 }
 const title="Gestão de fechos";
 return <>
 <AcaoRapidaCard
   icon={<CalendarCheck className="h-5 w-5"/>}
   label="Fecho diário"
   sublabel={portal==="secretaria"?(summary?.rejectedCount?"Caixa a regularizar":summary?.closed?"Expediente fechado":summary?"Expediente por fechar":"Gerir expediente"):(summary?.pendingCount?summary.pendingCount+" por validar":summary?.rejectedCount?summary.rejectedCount+" a regularizar":"Gerir fechos")}
   onClick={openWorkspace}
   buttonRef={triggerRef}
   dialogOpen={open}
 />
 <ModalShell open={open} size="wide" title={title} description={portal==="secretaria"?"Conclua o expediente sem sair do dashboard.":"Acompanhe e valide os fechos sem sair do dashboard."} onClose={()=>closeWorkspace()}
 footer={closeWarning?<div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{closeWarning==="busy"?"Existe uma operação em curso. Aguarde a conclusão antes de fechar.":"Existe uma conferência ou edição aberta. Fechar descartará alterações ainda não guardadas."}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>setCloseWarning(null)}>Continuar no expediente</Button>{closeWarning==="draft"&&<Button type="button" variant="destructive" onClick={()=>closeWorkspace(true)}>Descartar e fechar</Button>}</div></div>:undefined}>
 {open&&<Workspace escolaId={escolaId} portal={portal} initialHistory={initialHistory} embedded closeGuardRef={closeGuardRef}/>}
 </ModalShell>
 </>;
}
