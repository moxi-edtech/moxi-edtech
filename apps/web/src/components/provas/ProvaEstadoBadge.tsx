"use client";
import {useRef,useState} from "react";
import {ChevronDown} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {estados,type ProvaResumo} from "@/lib/provas/schema";

export type EstadoAction="submeter"|"aprovar"|"devolver"|"arquivar";
const transitions:Record<ProvaResumo["estado"],readonly {action:EstadoAction;label:string}[]>={
 rascunho:[{action:"submeter",label:"Em revisão"},{action:"aprovar",label:"Publicada"},{action:"arquivar",label:"Arquivada"}],
 em_revisao:[{action:"devolver",label:"Rascunho"},{action:"aprovar",label:"Publicada"}],
 aprovada:[{action:"arquivar",label:"Arquivada"}],
 arquivada:[],
};

export default function ProvaEstadoBadge({prova,admin,busy,onChange}:{prova:ProvaResumo;admin:boolean;busy:boolean;onChange:(prova:ProvaResumo,action:EstadoAction)=>Promise<void>}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState<EstadoAction|null>(null),[error,setError]=useState("");
 const trigger=useRef<HTMLButtonElement>(null);
 const options=admin?transitions[prova.estado]:[];
 const badge="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-medium "+(prova.estado==="aprovada"?"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200":prova.estado==="em_revisao"?"bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200":"bg-muted text-muted-foreground");
 if(!options.length)return <span className={badge}>{estados[prova.estado]}</span>;
 function dismiss(){setOpen(false);setPending(null);setError("");trigger.current?.focus({preventScroll:true});}
 async function confirm(){if(!pending||busy)return;setError("");try{await onChange(prova,pending);dismiss();}catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar o estado.");}}
 return <div className="min-w-0" onKeyDown={e=>{if(open&&e.key==="Escape"&&!busy){e.preventDefault();e.stopPropagation();dismiss();}}}>
  <button ref={trigger} type="button" disabled={busy} aria-label={"Alterar estado: "+prova.disciplina+" — "+estados[prova.estado]} aria-expanded={open} onClick={()=>{if(open)dismiss();else setOpen(true);}} className={badge+" text-left hover:ring-1 hover:ring-klasse-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klasse-gold/40 disabled:opacity-50"}><span className="min-w-0 break-words">{estados[prova.estado]}</span><ChevronDown className="size-3 shrink-0"/></button>
  {open&&<div role="group" aria-label="Alterar estado da prova" className="mt-2 min-w-0 space-y-1 rounded-xl border border-border bg-card p-2 text-xs shadow-sm">
   {pending?<><p className="break-words font-medium">Confirmar: {options.find(o=>o.action===pending)?.label}?</p>{pending==="aprovar"&&<p className="text-muted-foreground">Disponibiliza a prova para impressão.</p>}{pending==="arquivar"&&<p className="text-muted-foreground">Move a prova para o Histórico.</p>}<div className="flex flex-wrap gap-1"><Button type="button" size="sm" tone="gold" disabled={busy} onClick={()=>void confirm()}>Confirmar</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>{setPending(null);setError("");}}>Cancelar</Button></div></>:options.map(o=><button key={o.action} type="button" disabled={busy} onClick={()=>{setPending(o.action);setError("");}} className="block min-h-9 w-full rounded-lg px-2 py-1 text-left font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-klasse-gold/40">{o.label}</button>)}
   {error&&<p role="alert" className="break-words text-destructive">{error}</p>}
  </div>}
 </div>;
}
