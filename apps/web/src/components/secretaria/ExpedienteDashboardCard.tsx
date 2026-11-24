"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { CalendarCheck,ArrowRight } from "lucide-react";
type Summary={closed:null|{closed_at:string;operation_count:number};cashStatus:string|null;pendingCount:number|null;rejectedCount:number;canClose:boolean};
export default function ExpedienteDashboardCard({escolaId,portal}:{escolaId:string;portal:"secretaria"|"admin"|"operacoes"}){
 const [summary,setSummary]=useState<Summary|null>(null);
 useEffect(()=>{
 let active=true;let last=0;const controller=new AbortController();
 const refresh=()=>{if(Date.now()-last<15000)return;last=Date.now();fetch("/api/escola/"+encodeURIComponent(escolaId)+"/expediente?view=summary"+(portal==="secretaria"?"":"&scope=supervision"),{cache:"no-store",signal:controller.signal}).then(async r=>{const body=await r.json();if(active&&r.ok&&body.ok)setSummary(body);}).catch(()=>{});};
 setSummary(null);refresh();window.addEventListener("focus",refresh);
 return()=>{active=false;controller.abort();window.removeEventListener("focus",refresh);};
 },[escolaId,portal]);
 return <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
 <div className="flex items-start gap-3"><CalendarCheck className="mt-0.5 h-5 w-5 text-klasse-green"/><div><h2 className="font-semibold text-foreground">{portal==="secretaria"?"Fecho diário":"Controlo de expedientes"}</h2><p className="text-sm text-muted-foreground">{summary?.closed?"Expediente fechado · "+summary.closed.operation_count+" registos de atividade":summary?"Expediente de hoje por fechar":"Consulte o expediente e o histórico."}</p>{summary&&<p className="text-sm text-muted-foreground">{summary.cashStatus==="approved"?"Caixa aprovado":summary.cashStatus==="declared"?"Caixa a validar":summary.cashStatus==="rejected"?"Caixa a regularizar":"Caixa por declarar"}{summary.pendingCount!==null?" · "+summary.pendingCount+" por validar":""}{summary.rejectedCount>0?" · "+summary.rejectedCount+" a regularizar":""}</p>}</div></div>
 <Link className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted" href={"/escola/"+encodeURIComponent(escolaId)+"/"+portal+"/fecho-diario"+(portal==="secretaria"&&summary?.rejectedCount?"?history=1":"")}>{portal!=="secretaria"?"Consultar pendências":summary?.rejectedCount?"Regularizar caixa":summary&&!summary.closed&&summary.canClose?"Concluir expediente":"Consultar fecho"}<ArrowRight className="h-4 w-4"/></Link>
 </section>;
}
