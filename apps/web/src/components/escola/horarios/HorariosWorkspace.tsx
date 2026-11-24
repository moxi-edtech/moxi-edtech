"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarClock, CheckCircle2, Search, Pencil, Plus, RotateCcw, Settings } from "lucide-react";
import { type TimetablePublicationState } from "@/lib/horarios/timetable-publication-state";

type Turma = {
  id: string; nome?: string | null; turma_nome?: string | null; turma_codigo?: string | null;
  turno?: string | null; sala?: string | null; ano_letivo?: number | null;
  classe?: {nome?: string | null} | null; curso?: {nome?: string | null} | null;
  horario_status?: TimetablePublicationState;
};
const turnos: Record<string,string> = { M: "Manhã", T: "Tarde", N: "Noite" };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const turmaLabel = (t: Turma) => t.turma_codigo || t.turma_nome || t.nome || "Turma";
export function HorariosWorkspace({turmas, onOpen, onRefresh, onConfigure, loading, error}: {
  turmas: Turma[]; onOpen: (id: string) => void; onRefresh: () => void; onConfigure?: () => void; loading: boolean; error: string | null;
}) {
  const [search,setSearch] = useState("");
  const [turno,setTurno] = useState("");
  const [status,setStatus] = useState("");
  const [classe,setClasse] = useState("");
  const classes = [...new Set(turmas.map(t => t.classe?.nome).filter((n): n is string => Boolean(n)))].sort((a,b)=>a.localeCompare(b,"pt",{numeric:true}));
  const published = turmas.filter(t=>t.horario_status==="publicado").length;
  const drafts = turmas.filter(t=>t.horario_status==="rascunho").length;
  const missing = turmas.filter(t=>t.horario_status==="sem_horario").length;
  const unknown = turmas.length-published-drafts-missing;
  const visible = useMemo(()=>turmas.filter(t=>
    (!turno || t.turno===turno) && (!status || t.horario_status===status) && (!classe || t.classe?.nome===classe) &&
    normalize([turmaLabel(t),t.nome,t.classe?.nome,t.curso?.nome,t.sala].filter(Boolean).join(" ")).includes(normalize(search.trim()))
  ),[turmas,turno,status,classe,search]);
  const metrics = [{label:"Turmas",value:turmas.length,filter:""},{label:"Publicados",value:published,filter:"publicado"},{label:"Rascunhos",value:drafts,filter:"rascunho"},{label:"Sem horário",value:missing,filter:"sem_horario"}];
  return <section className="space-y-5 font-sora">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-klasse-green">Horários das turmas</h1><p className="text-sm text-muted-foreground">Ano lectivo activo · monte, reveja e publique os horários.</p></div>
      <div className="flex flex-wrap gap-2">{onConfigure&&<Button type="button" tone="gold" onClick={onConfigure} disabled={loading}><Settings size={16}/> Configurar tempos e salas</Button>}<button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"><RotateCcw size={16}/> Actualizar</button></div>
    </div>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={onRefresh} className="font-semibold underline">Tentar novamente</button></div> : loading ? <div role="status" className="rounded-xl border border-border bg-card p-6 text-sm">A carregar turmas…</div> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(m=><button key={m.label} type="button" aria-pressed={status===m.filter} onClick={()=>setStatus(m.filter)} className={"rounded-xl border bg-card p-4 text-left "+(status===m.filter?"border-klasse-gold ring-1 ring-klasse-gold/25":"border-border")}>
          <span className="block text-sm text-muted-foreground">{m.label}</span><span className="mt-1 block text-2xl font-semibold tabular-nums">{m.value}</span>
        </button>)}
      </div>
      {unknown>0 && <p role="status" className="text-sm text-muted-foreground">{unknown} turma(s) com estado por confirmar.</p>}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border px-3"><Search size={16} className="text-muted-foreground"/><input aria-label="Pesquisar turma" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar turma…" className="w-full bg-transparent py-2 text-sm outline-none"/></label>
          <select aria-label="Classe" value={classe} onChange={e=>setClasse(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm"><option value="">Todas as classes</option>{classes.map(c=><option key={c}>{c}</option>)}</select>
          <select aria-label="Turno" value={turno} onChange={e=>setTurno(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm"><option value="">Todos os turnos</option>{Object.entries(turnos).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Estado do horário" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm"><option value="">Todos os estados</option><option value="publicado">Publicado</option><option value="rascunho">Rascunho</option><option value="sem_horario">Sem horário</option></select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{["Turma","Classe","Turno","Sala","Horário","Acção"].map(h=><th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>
          {visible.map(t=><tr key={t.id} className="border-t border-border hover:bg-muted/30">
            <td className="px-4 py-3 font-semibold">{turmaLabel(t)}</td><td className="px-4 py-3">{t.classe?.nome||"—"}</td><td className="px-4 py-3">{turnos[t.turno||""]||"—"}</td><td className="px-4 py-3">{t.sala||"—"}</td>
            <td className="px-4 py-3"><span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium "+(t.horario_status==="publicado"?"bg-green-50 text-klasse-green":"bg-muted text-muted-foreground")}>{t.horario_status==="publicado"?<CheckCircle2 size={14}/>:<CalendarClock size={14}/>} {t.horario_status==="publicado"?"Publicado":t.horario_status==="rascunho"?"Rascunho":t.horario_status==="sem_horario"?"Sem horário":"Por confirmar"}</span></td>
            <td className="px-4 py-3"><Button type="button" tone={t.horario_status==="sem_horario"?"gold":"gray"} variant={t.horario_status==="sem_horario"?"default":"outline"} onClick={()=>onOpen(t.id)} className="gap-2 whitespace-nowrap">{t.horario_status==="sem_horario"?<Plus size={16}/>:<Pencil size={16}/>} {t.horario_status==="sem_horario"?"Montar horário":t.horario_status==="rascunho"?"Continuar":"Editar horário"}</Button></td>
          </tr>)}
        </tbody></table></div>
        {!visible.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma turma corresponde aos filtros.</p>}
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{visible.length} de {turmas.length} turmas</p>
      </div>
    </>}
  </section>;
}
