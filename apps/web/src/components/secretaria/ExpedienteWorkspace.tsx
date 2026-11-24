"use client";
import { useEffect, useRef, useState } from "react";
import FechoCaixaCego from "@/components/secretaria/FechoCaixaCego";
import { CalendarCheck, FileDown, LockKeyhole, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

const input = "rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20 outline-none";
const localDate = (value:Date) => new Intl.DateTimeFormat("sv-SE", { timeZone:"Africa/Luanda", year:"numeric", month:"2-digit", day:"2-digit" }).format(value);
const today = () => localDate(new Date());
const clock = (value: string) => new Intl.DateTimeFormat("pt-PT",{timeZone:"Africa/Luanda",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
const entityLabels: Record<string,string> = { alunos:"Alunos", candidaturas:"Candidaturas", matriculas:"Matrículas", pagamentos:"Pagamentos", documentos_emitidos:"Documentos emitidos", servico_pedidos:"Pedidos de serviço", mensalidades:"Propinas", notas:"Notas", financeiro_lancamentos:"Lançamentos financeiros", financeiro_estornos:"Estornos", reapreciacao_pedidos:"Reapreciações", frequencias:"Frequências",aluno_encarregados:"Encarregados",matricula_reclassificacoes:"Reclassificações",matricula_desistencia_sinalizacoes:"Desistências",matricula_desistencia_reativacoes:"Reativações",financeiro_pagamento_alocacoes:"Alocações",financeiro_pagamento_reversoes:"Reversões",financeiro_cobrancas:"Cobranças",financeiro_reconciliacoes_mensalidades:"Reconciliações",pautas_oficiais:"Pautas oficiais",pauta_conclusoes:"Conclusões de pauta",excecoes_pauta:"Exceções de pauta",professores:"Professores",turmas:"Turmas",turma_disciplinas:"Disciplinas",turma_disciplinas_professores:"Atribuições de professores",quadro_horarios:"Quadro de horários",horario_slots:"Tempos de horário",horario_versoes:"Versões de horário",horario_eventos:"Eventos de horário",aluno_falta_justificacoes:"Justificações de faltas",frequencia_status_periodo:"Fecho de frequência",rematricula_janelas:"Janelas de rematrícula",atendimentos_balcao:"Atendimentos",balcao_academic_operacoes:"Operações académicas do Balcão",balcao_historic_recovery_requests:"Pedidos de recuperação histórica",balcao_late_reenroll_authorizations:"Autorizações de rematrícula",melhoria_nota_pedidos:"Pedidos de melhoria de nota",official_document_exports:"Exportações documentais",virada_importacoes:"Importações de virada" };
const actionLabels: Record<string,string> = {CREATE:"Criação",UPDATE:"Alteração",DELETE:"Remoção"};
type Operation = { id:number; occurred_at:string; actor_name:string; entity:string; entity_id:string; action:string; record_kind:"business"|"mutation"; transaction_id:string; is_after_close:boolean; detail:Record<string,string> };
type Config = { close_time:string; reminder_minutes:number; weekdays:number[]; enabled:boolean };
type Data = { date:string; captureStartedAt:string; closed:null|{id:string;closed_at:string;closed_by_name:string;operation_count:number;business_count:number;human_count:number;system_count:number;summary:Record<string,number>}; operations:Operation[]; nextCursor:number|null; lateCount:number; variation:Record<string,number>|null; preview:Record<string,number>; cash:null|({id:string;status:string}&Record<string,string|number|null>); cashRevisions:{revision:number;snapshot:Record<string,unknown>;archived_at:string}[]; config:Config|null; canDeclare:boolean; canClose:boolean; canConfigure:boolean; canApprove:boolean };
const DEFAULT_CONFIG: Config = {close_time:"17:00",reminder_minutes:30,weekdays:[1,2,3,4,5],enabled:false};
const cashState = (state?:string) => state==="approved"?"Aprovado":state==="rejected"?"Rejeitado":state==="declared"?"A aguardar aprovação":"Por declarar";

export default function ExpedienteWorkspace({ escolaId, initialDate }: { escolaId:string; initialDate?:string }) {
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
  const [showCash,setShowCash] = useState(false);
  const [cashNote,setCashNote] = useState("");
  const [correctionReason,setCorrectionReason] = useState("");
  const correctionId = useRef<string|null>(null);
  const lock = useRef(false);
  const endpoint = "/api/escola/"+encodeURIComponent(escolaId)+"/expediente";
  useEffect(()=>{
    const controller = new AbortController();
    setData(null); setError(null); setLoading(true); setConfirm(false); setShowCash(false); setCashNote(""); setCorrectionReason(""); correctionId.current=null;
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
  async function declareCash(values:{numerario_declarado:number;tpa_declarado:number;transferencia_declarada:number;mcx_declarado:number;detalhe_notas:Record<string,number>}){
    const correction = data?.cash?.status==="rejected" ? {expectedRevision:Number(data.cash.revision),requestId:correctionId.current ?? (correctionId.current=crypto.randomUUID()),reason:correctionReason.trim()} : undefined;
    if(correction&&!correction.reason)throw new Error("Indique o motivo da regularização.");
    setBusy(true);
    try{
      const res=await fetch("/api/financeiro/fecho/declarar",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"fecho-"+date},body:JSON.stringify({escolaId,day_key:date,correction,declared:{cash:values.numerario_declarado,tpa:values.tpa_declarado,transfer:values.transferencia_declarada,mcx:values.mcx_declarado}})});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Falha ao declarar caixa.");
      const row=body.data;
      if(!row||["cash","tpa","transfer","mcx"].some(key=>row["system_"+key]==null||row["declared_"+key]==null||!Number.isFinite(Number(row["system_"+key]))||!Number.isFinite(Number(row["declared_"+key]))))throw new Error("Snapshot do caixa incompleto.");
      const sistema={numerario:Number(row.system_cash),tpa:Number(row.system_tpa),transferencia:Number(row.system_transfer),mcx:Number(row.system_mcx)};
      const declarado={numerario:Number(row.declared_cash),tpa:Number(row.declared_tpa),transferencia:Number(row.declared_transfer),mcx:Number(row.declared_mcx)};
      const differences=(Object.keys(sistema) as (keyof typeof sistema)[]).map(key=>Math.round(declarado[key]*100)-Math.round(sistema[key]*100));
      return {sistema,declarado,diferenca_total:differences.reduce((sum,n)=>sum+n,0)/100,outros: Number(row.system_other??0), outros_count:Number(row.system_other_count??0), status:differences.every(n=>n===0)&&Number(row.system_other_count??0)===0?"MATCH":"DIVERGENT"} as const;
    }finally{setBusy(false);}
  }
  async function decideCash(decision:"approved"|"rejected"){
    if(lock.current||!data?.cash||!data.canApprove)return;
    lock.current=true;setBusy(true);setError(null);
    try{
      const res=await fetch("/api/financeiro/fecho/aprovar",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"fecho-"+data.cash.id+"-"+decision},body:JSON.stringify({escolaId,fecho_id:data.cash.id,aprovacao:decision,justificativa:cashNote.trim()||undefined,meta:{expected_revision:Number(data.cash.revision??1)}})});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Falha ao decidir caixa.");
      setRevision(v=>v+1);
    }catch(err){setError(err instanceof Error?err.message:"Falha ao decidir caixa.");}
    finally{lock.current=false;setBusy(false);}
  }
  const money=(value:unknown)=>new Intl.NumberFormat("pt-AO",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value??0))+" Kz";
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
      <label className="grid gap-1 text-sm">Data<input type="date" value={date} max={today()} disabled={busy||showCash} className={input} onChange={e=>{if(e.target.value){setDate(e.target.value);setFrom(e.target.value);}}}/></label>
      {data?.closed&&<Button type="button" variant="outline" disabled={busy} onClick={()=>download(date,date)}><FileDown/> Exportar PDF</Button>}
      <label className="grid gap-1 text-sm">Desde<input type="date" value={from} max={date} disabled={busy} className={input} onChange={e=>setFrom(e.target.value)}/></label>
      <Button type="button" variant="outline" disabled={busy||!from||from>date} onClick={()=>download(from,date)}><FileDown/> Exportar período</Button>
      {data?.canConfigure&&<Button type="button" variant="outline" disabled={busy} onClick={()=>setSettings(v=>!v)}><Settings/> Lembretes</Button>}
    </div>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-card p-3 text-sm text-red-600">{error} <Button type="button" variant="ghost" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Atualizar</Button></div>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">A carregar expediente...</p>}
    {data&&<>
      {date<=localDate(new Date(data.captureStartedAt))&&<p role="status" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">{date<localDate(new Date(data.captureStartedAt))?"O registo operacional ainda não estava ativo nesta data. Não existe histórico consolidado.":"Cobertura parcial: o registo operacional foi ativado em "+clock(data.captureStartedAt)+"."}</p>}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-semibold text-foreground"><CalendarCheck className="h-5 w-5 text-klasse-green"/> {data.closed?"Expediente fechado":date<localDate(new Date(data.captureStartedAt))?"Histórico indisponível":"Expediente por fechar"}</h2><p className="mt-1 text-sm text-muted-foreground">{data.closed?clock(data.closed.closed_at)+" · "+data.closed.closed_by_name:"Confirme o resumo antes de encerrar o expediente."}</p></div>
          {!data.closed&&data.canClose&&<Button type="button" disabled={busy||showCash} className="bg-klasse-gold text-klasse-gold-900" onClick={()=>setConfirm(true)}><LockKeyhole/> Fechar expediente</Button>}
        </div>
        {confirm&&!data.closed&&<div className="rounded-xl border border-border p-3 space-y-2"><p className="text-sm">O resumo ficará registado e a administração será notificada. Operações posteriores ficam identificadas como adendos.</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</Button><Button type="button" loading={busy} className="bg-klasse-gold text-klasse-gold-900" onClick={()=>mutate({action:"close",date})}>Confirmar fecho</Button></div></div>}
        <><p className="font-mono text-xl font-semibold">{data.closed?.operation_count ?? Object.values(data.preview).reduce((sum,n)=>sum+Number(n),0)} <span className="font-sans text-sm font-normal text-muted-foreground">registos de atividade</span></p>{data.closed&&<p className="text-sm text-muted-foreground">Humanos: {data.closed.human_count} · Automáticos: {data.closed.system_count} · Registos de negócio distintos: {data.closed.business_count}</p>}<div className="grid gap-2 sm:grid-cols-3">{Object.entries(data.closed?.summary??data.preview).map(([entity,count])=><div key={entity} className="rounded-xl border border-border p-3"><p className="text-sm text-muted-foreground">{entityLabels[entity]??entity}</p><p className="font-mono font-semibold">{count}</p></div>)}</div>{data.closed&&<p className="text-sm text-muted-foreground">Adendos posteriores: {data.lateCount}</p>}</>
      </section>
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Wallet className="h-5 w-5 text-klasse-green"/> Fecho de caixa</h2><p className="text-sm text-muted-foreground">{cashState(data.cash?.status)} · Conferência financeira separada do expediente.</p></div>{!data.cash&&data.canDeclare&&!showCash&&<Button type="button" variant="outline" disabled={busy} onClick={()=>setShowCash(true)}>Declarar caixa</Button>}</div>
        {data.cash?.status==="rejected"&&data.canDeclare&&!showCash&&<div className="space-y-2"><p className="text-sm">Motivo da rejeição: {data.cash.approval_note??"—"}</p><Button variant="outline" disabled={busy} onClick={()=>{setShowCash(true);correctionId.current=crypto.randomUUID();}}>Regularizar caixa</Button></div>}
        {showCash&&data.cash?.status==="rejected"&&<label className="grid gap-1 text-sm">Motivo da regularização<input className={input} maxLength={255} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} disabled={busy}/></label>}
        {showCash&&(!data.cash||data.cash.status==="rejected")&&<FechoCaixaCego onConfirm={declareCash} onClose={()=>{setShowCash(false);setRevision(v=>v+1);}}/>}
        {data.cash&&<p className="text-sm text-muted-foreground">Versão {data.cash.revision??1}{data.cash.revision_reason?" · "+data.cash.revision_reason:""}</p>}
        {data.cashRevisions?.length>0&&<details className="rounded-xl border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Histórico de versões ({data.cashRevisions.length})</summary>{data.cashRevisions.map(r=><div key={r.revision} className="border-t border-border py-2"><p>Versão {r.revision} · {clock(r.archived_at)} · {String(r.snapshot.status)}</p><p>Decisão: {String(r.snapshot.approval_note??"—")}</p><p>Declarado: {["cash","tpa","transfer","mcx"].map(key=>money(r.snapshot["declared_"+key])).join(" / ")}</p></div>)}</details>}
        {data.cash&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Meio","Declarado","Sistema","Diferença"].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{[["cash","Numerário"],["tpa","TPA"],["transfer","Transferências"],["mcx","MCX"]].map(([key,label])=>{const declared=Number(data.cash?.["declared_"+key]??0);const system=Number(data.cash?.["system_"+key]??0);const difference=(Math.round(declared*100)-Math.round(system*100))/100;return <tr key={key}><td className="p-2">{label}</td><td className="p-2 font-mono">{money(declared)}</td><td className="p-2 font-mono">{money(system)}</td><td className={"p-2 font-mono "+(difference!==0?"text-red-600":"text-foreground")}>{money(difference)}</td></tr>;})}</tbody></table></div>}
        {data.variation&&Object.values(data.variation).some(n=>Number(n)!==0)&&<div className="rounded-xl border border-amber-200 p-3 text-sm"><p className="font-medium">Movimentos posteriores à declaração</p><p className="text-muted-foreground">Os valores originais permanecem intactos. Variação líquida por meio:</p>{[["cash","Numerário"],["tpa","TPA"],["transfer","Transferências"],["mcx","MCX"],["other","Não classificado"]].filter(([key])=>Number(data.variation?.[key])!==0).map(([key,label])=><p key={key}>{label}: <span className="font-mono">{money(data.variation?.[key])}</span></p>)}</div>}
        {data.cash&&Number(data.cash.system_other_count)>0&&<p role="status" className="rounded-xl border border-amber-200 p-3 text-sm text-foreground">Meio não classificado: {money(data.cash.system_other)} ({data.cash.system_other_count} pagamentos). Justifique qualquer aprovação com divergências.</p>}
        {!showCash&&data.cash?.status==="declared"&&data.canApprove&&<div className="flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 text-sm">Justificação<input className={input} maxLength={255} value={cashNote} onChange={e=>setCashNote(e.target.value)} /></label><Button type="button" variant="outline" disabled={busy||!cashNote.trim()} onClick={()=>decideCash("rejected")}>Rejeitar</Button><Button type="button" disabled={busy||((Object.values(data.variation??{}).some(n=>Number(n)!==0)||Number(data.cash.system_other_count)>0||["cash","tpa","transfer","mcx"].some(key=>Math.round(Number(data.cash?.["declared_"+key]??0)*100)!==Math.round(Number(data.cash?.["system_"+key]??0)*100)))&&!cashNote.trim())} className="bg-klasse-gold text-klasse-gold-900" onClick={()=>decideCash("approved")}>Aprovar caixa</Button></div>}
      </section>
      {settings&&data.canConfigure&&<section className="rounded-xl border border-border bg-card p-4 space-y-3"><h2 className="font-semibold">Horário de fecho (Angola)</h2><div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Hora<input type="time" className={input} value={config.close_time.slice(0,5)} onChange={e=>setConfig(v=>({...v,close_time:e.target.value}))}/></label><label className="grid gap-1 text-sm">Antecedência (minutos)<input type="number" min={0} max={180} className={input} value={config.reminder_minutes} onChange={e=>setConfig(v=>({...v,reminder_minutes:Number(e.target.value)}))}/></label></div><div className="flex flex-wrap gap-3">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((label,i)=><label key={label} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={config.weekdays.includes(i+1)} onChange={e=>setConfig(v=>({...v,weekdays:e.target.checked?[...v.weekdays,i+1]:v.weekdays.filter(d=>d!==i+1)}))}/>{label}</label>)}</div><label className="flex gap-2 text-sm"><input type="checkbox" checked={config.enabled} onChange={e=>setConfig(v=>({...v,enabled:e.target.checked}))}/> Ativar lembretes</label><p className="text-xs text-muted-foreground">O lembrete é enviado apenas após guardar estas preferências.</p><Button type="button" disabled={busy||!config.close_time||!config.weekdays.length||!Number.isInteger(config.reminder_minutes)||config.reminder_minutes<0||config.reminder_minutes>180} onClick={()=>mutate({action:"configure",closeTime:config.close_time.slice(0,5),reminderMinutes:config.reminder_minutes,weekdays:config.weekdays,enabled:config.enabled})}>Guardar preferências</Button></section>}
      <section className="rounded-xl border border-border bg-card overflow-hidden"><div className="p-4"><h2 className="font-semibold">Registos de atividade</h2><p className="text-sm text-muted-foreground">Alterações persistidas nas entidades de negócio. As atividades automáticas não são atribuídas a funcionários; os registos não equivalem a atendimentos únicos.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-muted/50"><tr>{["Hora","Operação","Responsável","Referência","Momento"].map(h=><th scope="col" key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.operations.map(op=><tr key={op.id}><td className="p-3 whitespace-nowrap">{clock(op.occurred_at)}</td><td className="p-3">{actionLabels[op.action]??op.action} · {entityLabels[op.entity]??op.entity}<span className="block text-xs text-muted-foreground">{op.record_kind==="business"?"Registo de negócio":"Mutação técnica"} · Tx {op.transaction_id}</span>{op.detail?.status&&<span className="block text-xs text-muted-foreground">{op.detail.status}</span>}{op.detail?.payment_day&&op.detail.payment_day!==date&&<span className="block text-xs text-muted-foreground">Data financeira: {op.detail.payment_day}</span>}</td><td className="p-3">{op.actor_name}</td><td className="p-3 font-mono text-xs break-all">{op.entity_id}</td><td className="p-3">{op.is_after_close?"Adendo":"Expediente"}</td></tr>)}</tbody></table></div>{!data.operations.length&&<p className="p-4 text-sm text-muted-foreground">Sem registos capturados nesta data.</p>}{data.nextCursor&&<div className="p-3"><Button variant="outline" disabled={busy} onClick={more}>Carregar mais</Button></div>}</section>
    </>}
  </div>;
}
