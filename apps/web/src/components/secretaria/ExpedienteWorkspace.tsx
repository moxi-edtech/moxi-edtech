"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, FileDown, LockKeyhole, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

const input = "rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20 outline-none";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone:"Africa/Luanda", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const clock = (value: string) => new Intl.DateTimeFormat("pt-PT",{timeZone:"Africa/Luanda",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
const entityLabels: Record<string,string> = { alunos:"Alunos", candidaturas:"Candidaturas", matriculas:"Matrículas", pagamentos:"Pagamentos", documentos_emitidos:"Documentos emitidos", servico_pedidos:"Pedidos de serviço", mensalidades:"Propinas", notas:"Notas", financeiro_lancamentos:"Lançamentos financeiros", financeiro_estornos:"Estornos", reapreciacao_pedidos:"Reapreciações", frequencias:"Frequências" };
const actionLabels: Record<string,string> = {CREATE:"Criação",UPDATE:"Alteração",DELETE:"Remoção"};
type Operation = { id:number; occurred_at:string; actor_name:string; entity:string; entity_id:string; action:string; is_after_close:boolean; detail:Record<string,string> };
type Config = { close_time:string; reminder_minutes:number; weekdays:number[]; enabled:boolean };
type Data = { date:string; closed:null|{id:string;closed_at:string;closed_by_name:string;operation_count:number;summary:Record<string,number>}; operations:Operation[]; nextCursor:number|null; lateCount:number; preview:Record<string,number>; cash:null|{status:string}; config:Config|null; canClose:boolean; canConfigure:boolean };
const DEFAULT_CONFIG: Config = {close_time:"17:00",reminder_minutes:30,weekdays:[1,2,3,4,5],enabled:false};
const cashState = (state?:string) => state==="approved"?"Aprovado":state==="rejected"?"Rejeitado":state==="declared"?"A aguardar aprovação":"Por declarar";

export default function ExpedienteWorkspace({ escolaId, initialDate, cashHref }: { escolaId:string; initialDate?:string; cashHref:string }) {
  const [date,setDate] = useState(initialDate ?? today());
  const [from,setFrom] = useState(initialDate ?? today());
  const [data,setData] = useState<Data|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [settings,setSettings] = useState(false);
  const [config,setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [revision,setRevision] = useState(0);
  const [confirm,setConfirm] = useState(false);
  const lock = useRef(false);
  const endpoint = "/api/escola/"+encodeURIComponent(escolaId)+"/expediente";
  useEffect(()=>{
    const controller = new AbortController();
    setData(null); setError(null); setLoading(true); setConfirm(false);
    fetch(endpoint+"?date="+encodeURIComponent(date),{cache:"no-store",signal:controller.signal})
      .then(async res=>{const body=await res.json(); if(!res.ok||!body.ok)throw new Error(body.error||"Falha ao consultar expediente."); if(!controller.signal.aborted){setData(body);setConfig(body.config??DEFAULT_CONFIG);}})
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Falha ao consultar expediente.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[endpoint,date,revision]);

  async function mutate(payload:Record<string,unknown>){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError(null);
    try{
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||"Não foi possível concluir.");
      setConfirm(false);setSettings(false);setRevision(v=>v+1);
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível concluir.");}
    finally{lock.current=false;setBusy(false);}
  }
  async function more(){
    if(lock.current||!data?.nextCursor)return;
    lock.current=true;setBusy(true);setError(null);
    try{
      const res=await fetch(endpoint+"?date="+encodeURIComponent(date)+"&cursor="+data.nextCursor,{cache:"no-store"});
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||"Não foi possível carregar mais.");
      setData(prev=>prev?.date===date?{...prev,operations:[...prev.operations,...body.operations],nextCursor:body.nextCursor,lateCount:body.lateCount}:prev);
    }catch(err){setError(err instanceof Error?err.message:"Falha ao carregar.");}
    finally{lock.current=false;setBusy(false);}
  }
  async function download(start:string,end:string){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError(null);
    try{
      const res=await fetch(endpoint+"/pdf?from="+encodeURIComponent(start)+"&to="+encodeURIComponent(end));
      if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error||"Falha ao exportar PDF.");}
      const url=URL.createObjectURL(await res.blob());
      const anchor=document.createElement("a");anchor.href=url;anchor.download="fecho-diario-"+start+"-"+end+".pdf";document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){setError(err instanceof Error?err.message:"Falha ao exportar PDF.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className={PORTAL_PAGE_INSET+" space-y-4"}>
    <DashboardHeader title="Fecho diário" description="Atividade da secretaria, conferência de caixa e histórico de expedientes."/>
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">Data<input type="date" value={date} max={today()} disabled={busy} className={input} onChange={e=>{if(e.target.value){setDate(e.target.value);setFrom(e.target.value);}}}/></label>
      {data?.closed&&<Button type="button" variant="outline" disabled={busy} onClick={()=>download(date,date)}><FileDown/> Exportar PDF</Button>}
      <label className="grid gap-1 text-sm">Desde<input type="date" value={from} max={date} disabled={busy} className={input} onChange={e=>setFrom(e.target.value)}/></label>
      <Button type="button" variant="outline" disabled={busy||!from||from>date} onClick={()=>download(from,date)}><FileDown/> Exportar período</Button>
      {data?.canConfigure&&<Button type="button" variant="outline" disabled={busy} onClick={()=>setSettings(v=>!v)}><Settings/> Lembretes</Button>}
    </div>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-card p-3 text-sm text-red-600">{error} <Button type="button" variant="ghost" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Atualizar</Button></div>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">A carregar expediente...</p>}
    {data&&<>
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-semibold text-foreground"><CalendarCheck className="h-5 w-5 text-klasse-green"/> {data.closed?"Expediente fechado":"Expediente por fechar"}</h2><p className="mt-1 text-sm text-muted-foreground">{data.closed?clock(data.closed.closed_at)+" · "+data.closed.closed_by_name:"Confirme o resumo antes de encerrar o expediente."}</p></div>
          {!data.closed&&data.canClose&&<Button type="button" disabled={busy} className="bg-klasse-gold text-klasse-gold-900" onClick={()=>setConfirm(true)}><LockKeyhole/> Fechar expediente</Button>}
        </div>
        {confirm&&!data.closed&&<div className="rounded-xl border border-border p-3 space-y-2"><p className="text-sm">O resumo ficará registado e a administração será notificada. Operações posteriores ficam identificadas como adendos.</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</Button><Button type="button" loading={busy} className="bg-klasse-gold text-klasse-gold-900" onClick={()=>mutate({action:"close",date})}>Confirmar fecho</Button></div></div>}
        <><p className="font-mono text-xl font-semibold">{data.closed?.operation_count ?? Object.values(data.preview).reduce((sum,n)=>sum+Number(n),0)} <span className="font-sans text-sm font-normal text-muted-foreground">registos de atividade</span></p><div className="grid gap-2 sm:grid-cols-3">{Object.entries(data.closed?.summary??data.preview).map(([entity,count])=><div key={entity} className="rounded-xl border border-border p-3"><p className="text-sm text-muted-foreground">{entityLabels[entity]??entity}</p><p className="font-mono font-semibold">{count}</p></div>)}</div>{data.closed&&<p className="text-sm text-muted-foreground">Adendos posteriores: {data.lateCount}</p>}</>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><h2 className="flex items-center gap-2 font-semibold"><Wallet className="h-5 w-5 text-klasse-green"/> Fecho de caixa</h2><p className="text-sm text-muted-foreground">{cashState(data.cash?.status)} · Conferência financeira separada do expediente.</p></div><Button asChild variant="outline"><Link href={cashHref+(cashHref.includes("?")?"&":"?")+"date="+encodeURIComponent(date)}>Consultar caixa</Link></Button></section>
      {settings&&data.canConfigure&&<section className="rounded-xl border border-border bg-card p-4 space-y-3"><h2 className="font-semibold">Horário de fecho (Angola)</h2><div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Hora<input type="time" className={input} value={config.close_time.slice(0,5)} onChange={e=>setConfig(v=>({...v,close_time:e.target.value}))}/></label><label className="grid gap-1 text-sm">Antecedência (minutos)<input type="number" min={0} max={180} className={input} value={config.reminder_minutes} onChange={e=>setConfig(v=>({...v,reminder_minutes:Number(e.target.value)}))}/></label></div><div className="flex flex-wrap gap-3">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((label,i)=><label key={label} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={config.weekdays.includes(i+1)} onChange={e=>setConfig(v=>({...v,weekdays:e.target.checked?[...v.weekdays,i+1]:v.weekdays.filter(d=>d!==i+1)}))}/>{label}</label>)}</div><label className="flex gap-2 text-sm"><input type="checkbox" checked={config.enabled} onChange={e=>setConfig(v=>({...v,enabled:e.target.checked}))}/> Ativar lembretes</label><p className="text-xs text-muted-foreground">O lembrete é enviado apenas após guardar estas preferências.</p><Button type="button" disabled={busy||!config.close_time||!config.weekdays.length||!Number.isInteger(config.reminder_minutes)||config.reminder_minutes<0||config.reminder_minutes>180} onClick={()=>mutate({action:"configure",closeTime:config.close_time.slice(0,5),reminderMinutes:config.reminder_minutes,weekdays:config.weekdays,enabled:config.enabled})}>Guardar preferências</Button></section>}
      <section className="rounded-xl border border-border bg-card overflow-hidden"><div className="p-4"><h2 className="font-semibold">Registos de atividade</h2><p className="text-sm text-muted-foreground">Alterações persistidas nas entidades de negócio, não contagem de atendimentos únicos.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-muted/50"><tr>{["Hora","Operação","Responsável","Referência","Momento"].map(h=><th scope="col" key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.operations.map(op=><tr key={op.id}><td className="p-3 whitespace-nowrap">{clock(op.occurred_at)}</td><td className="p-3">{actionLabels[op.action]??op.action} · {entityLabels[op.entity]??op.entity}{op.detail?.status&&<span className="block text-xs text-muted-foreground">{op.detail.status}</span>}</td><td className="p-3">{op.actor_name}</td><td className="p-3 font-mono text-xs break-all">{op.entity_id}</td><td className="p-3">{op.is_after_close?"Adendo":"Expediente"}</td></tr>)}</tbody></table></div>{!data.operations.length&&<p className="p-4 text-sm text-muted-foreground">Sem registos capturados nesta data.</p>}{data.nextCursor&&<div className="p-3"><Button variant="outline" disabled={busy} onClick={more}>Carregar mais</Button></div>}</section>
    </>}
  </div>;
}
