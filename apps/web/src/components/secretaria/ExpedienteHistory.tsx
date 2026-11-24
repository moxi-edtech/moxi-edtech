"use client";
import {useEffect,useState} from "react";
import {ArrowRight,CalendarCheck,ChevronLeft,ChevronRight,Filter} from "lucide-react";
import {Button} from "@/components/ui/Button";
type Day={date:string;closedAt:string|null;records:number|null;expected:boolean;cashStatus:string|null;canApprove:boolean};
type Queue={date:string;status:string;revision:number;canApprove:boolean};
type History={days:Day[];closedCount:number;missingCount:number;pendingCount:number;rejectedCount:number;pending:Queue[];rejected:Queue[];scheduleConfigured:boolean;captureDay:string};
const dateLabel=(date:string)=>new Intl.DateTimeFormat("pt-PT",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T00:00:00Z"));
const cashLabel=(status:string|null)=>status==="approved"?"Aprovado":status==="declared"?"Por validar":status==="rejected"?"A regularizar":status==="draft"?"Rascunho":"Sem declaração";
const dateKey=(date:Date)=>date.toISOString().slice(0,10);
export default function ExpedienteHistory({endpoint,today,selected,onSelect,supervise,refresh,disabled}:{endpoint:string;today:string;selected:string;onSelect:(day:string)=>void;supervise:boolean;refresh:number;disabled:boolean}){
 const [month,setMonth]=useState(selected.slice(0,7));
 const [status,setStatus]=useState("all");
 const [data,setData]=useState<History|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [retry,setRetry]=useState(0);
 const [year,m]=month.split("-").map(Number);
 const start=month+"-01";
 const end=[dateKey(new Date(Date.UTC(year,m,0))),today].sort()[0];
 function move(delta:number){setMonth(dateKey(new Date(Date.UTC(year,m-1+delta,1))).slice(0,7));}
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");setData(null);
 fetch(endpoint+"?view="+(supervise?"supervision":"history")+"&from="+start+"&to="+end,{signal:c.signal,cache:"no-store"})
 .then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error||"Falha ao consultar histórico.");if(!c.signal.aborted)setData(b);})
 .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Falha ao consultar histórico.");})
 .finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[endpoint,start,end,supervise,refresh,retry]);
 const days=data?.days.filter(d=>status==="all"||status==="closed"&&d.closedAt||status==="open"&&!d.closedAt||status==="pending"&&d.cashStatus==="declared"||status==="rejected"&&d.cashStatus==="rejected")??[];
 const monthLabel=new Intl.DateTimeFormat("pt-PT",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(start+"T00:00:00Z"));
 return <section className="rounded-xl border border-border bg-card p-4 space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 font-semibold"><CalendarCheck className="h-5 w-5 text-klasse-green"/>{supervise?"Supervisão dos expedientes":"Histórico de expedientes"}</h2><p className="text-sm text-muted-foreground">{supervise?"Consulte primeiro os caixas que precisam de decisão.":"Consulte os dias anteriores sem sair do workspace."}</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" disabled={disabled} aria-label="Mês anterior" onClick={()=>move(-1)}><ChevronLeft className="h-4 w-4"/></Button><span className="text-sm font-medium capitalize">{monthLabel}</span><Button type="button" variant="ghost" disabled={disabled||month>=today.slice(0,7)} aria-label="Mês seguinte" onClick={()=>move(1)}><ChevronRight className="h-4 w-4"/></Button></div></div>
 {error&&<div role="alert" className="text-sm text-red-600">{error} <Button variant="ghost" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</Button></div>}
 {loading&&<div role="status" className="space-y-2 animate-pulse"><div className="h-12 rounded-xl bg-muted"/><div className="h-8 rounded-xl bg-muted"/><span className="sr-only">A carregar histórico</span></div>}
 {data&&<>
 {supervise&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Fechados no mês",data.closedCount],["Dias anteriores por fechar",data.scheduleConfigured?data.missingCount:"—"],["Caixas por validar",data.pendingCount],["Caixas a regularizar",data.rejectedCount]].map(([label,n])=><div key={label} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono text-xl font-semibold">{n}</p></div>)}</div>
 {!data.scheduleConfigured&&<p className="text-xs text-muted-foreground">Configure os dias de funcionamento para identificar expedientes em atraso.</p>}
 {(data.pendingCount>0||data.rejectedCount>0)&&<div className="space-y-2"><h3 className="font-medium text-sm">Pendências de caixa · todas as datas</h3>{[...data.pending,...data.rejected].map(item=><div key={item.date} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"><div><p className="font-medium text-sm">{dateLabel(item.date)}</p><p className="text-xs text-muted-foreground">{cashLabel(item.status)} · versão {item.revision}{item.status==="declared"&&!item.canApprove?" · necessita outro responsável autorizado":""}</p></div><Button variant="outline" type="button" disabled={disabled} onClick={()=>onSelect(item.date)}>{item.status==="declared"&&item.canApprove?"Validar":"Consultar"}<ArrowRight className="h-4 w-4"/></Button></div>)}{data.pendingCount>data.pending.length||data.rejectedCount>data.rejected.length?<p className="text-xs text-muted-foreground">Mostrando até 20 pendências mais antigas de cada estado. Utilize o histórico para as restantes.</p>:null}</div>}
 </>}
 <label className="flex flex-wrap items-center gap-2 text-sm"><Filter className="h-4 w-4"/> Estado<select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm"><option value="all">Todos</option><option value="closed">Fechados</option><option value="open">Por fechar</option><option value="pending">Caixa por validar</option><option value="rejected">Caixa a regularizar</option></select></label>
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border"><tr>{["Data","Expediente","Caixa","Atividade","Ação"].map(h=><th scope="col" key={h} className="p-2">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{days.map(d=><tr key={d.date} className={selected===d.date?"bg-muted/50":""}><td className="p-2 whitespace-nowrap">{dateLabel(d.date)}</td><td className="p-2">{d.closedAt?<span className="text-klasse-green">Fechado</span>:d.date<data.captureDay?"Sem cobertura":d.expected||d.date===today?"Por fechar":"Sem fecho registado"}</td><td className="p-2">{cashLabel(d.cashStatus)}</td><td className="p-2 font-mono">{d.records??"—"}</td><td className="p-2"><Button type="button" variant="ghost" disabled={disabled} onClick={()=>onSelect(d.date)}>{selected===d.date?"Selecionado":"Consultar"}</Button></td></tr>)}</tbody></table></div>
 {!days.length&&<p className="py-3 text-sm text-muted-foreground">Sem expedientes correspondentes neste mês.</p>}
 {end<data.captureDay&&<p className="text-xs text-muted-foreground">A captura de atividade ainda não estava ativa neste período.</p>}
 </>}
 </section>;
}
