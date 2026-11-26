"use client";
import {useEffect,useState} from "react";
import {CalendarCheck} from "lucide-react";
import {Button} from "@/components/ui/Button";
import type {Prova} from "@/lib/provas/schema";
type Turma={id:string;nome:string;turno:string|null};
type Event={id:string;turma_id:string;data:string;inicio:string;fim:string|null;estado:string};
const input="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-4 focus:ring-klasse-gold/20";
export default function ProvasSchedulePanel({endpoint,prova}:{endpoint:string;prova:Prova}){
 const [turmas,setTurmas]=useState<Turma[]>([]),[events,setEvents]=useState<Event[]>([]),[turma,setTurma]=useState(""),[data,setData]=useState(prova.data_realizacao??""),[inicio,setInicio]=useState(prova.hora_inicio?.slice(0,5)??""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");fetch(endpoint+"/agendamento?prova="+encodeURIComponent(prova.id),{signal:c.signal,cache:"no-store"}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);if(!c.signal.aborted){setTurmas(b.turmas);setEvents(b.eventos);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[endpoint,prova.id,revision]);
 const pending=turmas.filter(t=>!events.some(e=>e.turma_id===t.id));
 return <section className="space-y-3 rounded-xl border border-border p-3">
  <h3 className="font-semibold text-klasse-green">Agendamento por turma</h3><p className="text-xs text-muted-foreground">Publica apenas data, hora e disciplina no calendário de avaliações. O enunciado não é publicado para alunos. Para reagendar ou cancelar, utilize o calendário de avaliações.</p>
  {events.map(e=><div key={e.id} className="rounded-xl border border-border p-3 text-sm"><p className="font-medium">{turmas.find(t=>t.id===e.turma_id)?.nome??"Turma histórica"}</p><p>{e.data.split("-").reverse().join("/")} · {e.inicio.slice(0,5)}–{e.fim?.slice(0,5)??"—"} · {e.estado==="publicado"?"Publicado":"Rascunho"}</p></div>)}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {loading?<p role="status" className="text-sm">A carregar turmas...</p>:<form className="grid gap-3 sm:grid-cols-3" onSubmit={async e=>{e.preventDefault();if(busy||!turma||!data||!inicio)return;setBusy(true);setError("");try{const r=await fetch(endpoint+"/agendamento",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prova:prova.id,versao:prova.versao,turma,data,inicio})});const b=await r.json();if(!r.ok)throw Error(b.error);setTurma("");setRevision(v=>v+1);}catch(e){setError(e instanceof Error?e.message:"Agendamento indisponível.");}finally{setBusy(false);}}}>
   <label className="grid gap-1 text-sm">Turma<select className={input} value={turma} onChange={e=>setTurma(e.target.value)} required><option value="">Seleccione</option>{pending.map(t=><option value={t.id} key={t.id}>{t.nome} · {t.turno??""}</option>)}</select></label>
   <label className="grid gap-1 text-sm">Data<input className={input} type="date" value={data} onChange={e=>setData(e.target.value)} required/></label>
   <label className="grid gap-1 text-sm">Hora<input className={input} type="time" value={inicio} onChange={e=>setInicio(e.target.value)} required/></label>
   <Button className="sm:col-span-3" type="submit" tone="gold" disabled={busy||!turma||!data||!inicio}><CalendarCheck/> Agendar e publicar no calendário</Button>
  </form>}
 </section>;
}
