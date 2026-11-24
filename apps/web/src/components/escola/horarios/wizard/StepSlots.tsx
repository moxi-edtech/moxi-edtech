"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Clock, Plus, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildTurnoTemplate } from "@/lib/horarios/turno-template";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface Slot {
  id: string;
  dia_semana: number;
  turno_id: string;
  inicio: string;
  fim: string;
  ordem: number;
  is_intervalo?: boolean;
}

interface StepSlotsProps {
  escolaId: string;
  onComplete: () => void;
  initialTurno?: string | null;
}

const TURNOS = [
  { id: "matinal", label: "Matinal" },
  { id: "tarde", label: "Vespertino" },
  { id: "noite", label: "Noturno" },
];

const DIAS = [
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
];

type SlotApiError = { error?: string; detail?: { inicio?: string; fim?: string; conflicting_with?: { inicio?: string; fim?: string } } };
type SlotPayload = Omit<Slot, "id">;

function formatSlotSaveError(json: SlotApiError) {
  if (json?.error === "SLOT_TEMPORAL_CONFLICT") {
    const detail = json?.detail;
    const current = detail?.inicio && detail?.fim ? `${detail.inicio}-${detail.fim}` : "um dos tempos";
    const other = detail?.conflicting_with?.inicio && detail?.conflicting_with?.fim
      ? `${detail.conflicting_with.inicio}-${detail.conflicting_with.fim}`
      : "outro tempo";
    return `Conflito de horário: ${current} sobrepõe ${other}. Ajuste os tempos antes de salvar.`;
  }
  if (json?.error === "SLOT_TIME_RANGE_INVALID") {
    return "Horário inválido: a hora de início deve ser anterior à hora de fim.";
  }
  return json?.error || "Falha ao salvar slots.";
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function StepSlots({ escolaId, onComplete, initialTurno }: StepSlotsProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTurno, setActiveTurno] = useState(initialTurno || "matinal");
  const [templateOpen,setTemplateOpen] = useState(false);
  const [template,setTemplate] = useState({inicio:initialTurno==="tarde"?"13:00":initialTurno==="noite"?"18:00":"07:00",aulas:6,minutos:45,pausaApos:3,pausaMinutos:15,intervaloEntre:5,dias:[1,2,3,4,5]});
  const [loadError,setLoadError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const { success, error } = useToast();

  const [newSlot, setNewSlot] = useState({
    inicio: "07:15",
    fim: "08:05",
    is_intervalo: false,
    ordem: 1
  });
  const [savingSlot, setSavingSlot] = useState(false);

  const turnSlots = slots.filter(slot=>slot.turno_id===activeTurno);
  const firstDay = Math.min(...turnSlots.map(slot=>slot.dia_semana));
  const activeSlots = turnSlots.filter(slot=>slot.dia_semana===firstDay).sort((a,b)=>a.ordem-b.ordem);
  let generated: ReturnType<typeof buildTurnoTemplate> | null = null;
  let templateError: string | null = null;
  try {generated=buildTurnoTemplate({...template,turno:activeTurno});} catch(e){templateError=e instanceof Error?e.message:"Configuração inválida";}
  const localConflicts = activeSlots.flatMap((slot, index) => activeSlots.slice(index + 1).filter((other) => toMinutes(slot.inicio) < toMinutes(other.fim) && toMinutes(other.inicio) < toMinutes(slot.fim)).map((other) => `${slot.ordem}º tempo (${slot.inicio}-${slot.fim}) sobrepõe o ${other.ordem}º (${other.inicio}-${other.fim})`));
  const newSlotConflict = activeSlots.find((slot) => toMinutes(newSlot.inicio) < toMinutes(slot.fim) && toMinutes(slot.inicio) < toMinutes(newSlot.fim));
  const newSlotInvalid = toMinutes(newSlot.inicio) >= toMinutes(newSlot.fim);

  const fetchSlots = useCallback(async () => {
    setLoading(true);setLoadError(false);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error||"Não foi possível carregar os tempos");
      setSlots(json.items || []);
    } catch (_e) {
      setLoadError(true);error("Falha ao carregar horários.");
    } finally {
      setLoading(false);
    }
  }, [escolaId, error]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  const handleAutoGenerate = async () => {
    if (loading || loadError || savingSlot || turnSlots.length || !generated) return;
    setSavingSlot(true);
    try {
      const res=await fetch(`/api/escolas/${escolaId}/horarios/slots`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slots:generated.items})});
      const json=await res.json().catch(()=>({}));
      if(!res.ok||!json.ok){error(formatSlotSaveError(json));return;}
      success("Tempos configurados", "A estrutura foi guardada para os dias seleccionados.");
      setTemplateOpen(false);await fetchSlots();
    }catch{error("Erro na rede. Não foi possível confirmar a gravação.");}finally{setSavingSlot(false);}
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if(loading||loadError||savingSlot||newSlotInvalid||newSlotConflict||localConflicts.length)return;
    setSavingSlot(true);
    
    // Adiciona para todos os dias da semana para simplificar o Wizard
    const payload = DIAS.map(dia => ({
      ...newSlot,
      turno_id: activeTurno,
      dia_semana: dia.id
    }));

    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
        method: "POST",
        body: JSON.stringify({ slots: payload }),
      });
      const json = await res.json();
      if (json.ok) {
        success("Tempo adicionado!");
        setShowAddModal(false);
        await fetchSlots();
      } else {
        error(formatSlotSaveError(json));
      }
    } catch (_e) {
      error("Erro na rede.");
    } finally {
      setSavingSlot(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-card shadow-sm border border-border">
            <Clock className="h-8 w-8 text-amber" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Grade de Tempos</h2>
            <p className="text-sm text-muted-foreground">Defina os horários de início e fim de cada tempo de aula.</p>
          </div>
        </div>
        <Button 
          tone="gold" 
          variant="outline" 
          onClick={() => {setNewSlot(v=>({...v,ordem:Math.max(0,...turnSlots.map(s=>s.ordem))+1}));setShowAddModal(true)}}
          disabled={loading||loadError||savingSlot} 
          className="gap-2 font-black border-2"
        >
          <Plus className="w-4 h-4" /> Novo Tempo
        </Button>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm mb-6">
        <div className="flex border-b border-border p-2 gap-2 bg-muted/50">
          {TURNOS.map(t => (
            <button
              key={t.id}
              disabled={savingSlot}
              onClick={() => {setActiveTurno(t.id);setTemplateOpen(false);setTemplate(v=>({...v,inicio:t.id==="tarde"?"13:00":t.id==="noite"?"18:00":"07:00"}));}}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTurno === t.id 
                  ? "bg-card text-amber shadow-sm ring-1 ring-ring"
                  : "text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loadError ? <div role="alert" className="text-sm text-red-700">Não foi possível carregar os tempos. <button type="button" onClick={()=>void fetchSlots()} className="underline">Tentar novamente</button></div> : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-12 w-full rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Configuração de {TURNOS.find(t => t.id === activeTurno)?.label}</h3>
                {!turnSlots.length&&<Button variant="outline" size="sm" onClick={()=>setTemplateOpen(true)} disabled={savingSlot} className="gap-2"><Wand2 className="h-4 w-4"/> Configurar semana</Button>}
              </div>

              {templateOpen&&!turnSlots.length&&<form className="space-y-4 rounded-xl border border-border bg-card p-4" onSubmit={e=>{e.preventDefault();void handleAutoGenerate()}}>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <label className="text-sm">Início<input type="time" required value={template.inicio} onChange={e=>setTemplate(v=>({...v,inicio:e.target.value}))} className="mt-1 block w-full rounded-xl border border-border p-2"/></label>
                  {([{key:"aulas",label:"Aulas por dia",min:1,max:16},{key:"minutos",label:"Minutos por aula",min:15,max:120},{key:"intervaloEntre",label:"Pausa entre aulas (min)",min:0,max:30},{key:"pausaApos",label:"Intervalo após a aula",min:0,max:15},{key:"pausaMinutos",label:"Duração do intervalo",min:0,max:120}] as const).map(f=><label key={f.key} className="text-sm">{f.label}<input type="number" required min={f.min} max={f.max} value={template[f.key]} onChange={e=>setTemplate(v=>({...v,[f.key]:Number(e.target.value)}))} className="mt-1 block w-full rounded-xl border border-border p-2"/></label>)}
                </div>
                <div className="flex flex-wrap gap-3">{DIAS.map(d=><label key={d.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={template.dias.includes(d.id)} onChange={e=>setTemplate(v=>({...v,dias:e.target.checked?[...v.dias,d.id].sort():v.dias.filter(x=>x!==d.id)}))}/>{d.label}</label>)}</div>
                {templateError?<p role="alert" className="text-sm text-red-700">{templateError}</p>:<div className="rounded-xl bg-muted p-3 text-sm"><p className="mb-2 font-semibold">Prévia · {generated?.items.length} registos</p>{generated?.preview.map(p=><div key={p.ordem} className="flex justify-between gap-2"><span>{p.is_intervalo?"Intervalo":p.ordem+"º tempo"}</span><span>{p.inicio} – {p.fim}</span></div>)}</div>}
                <p className="text-xs text-muted-foreground">Aplique apenas a um turno ainda sem tempos. Os horários existentes não serão substituídos.</p>
                <Button type="submit" tone="gold" loading={savingSlot} disabled={!generated||savingSlot}>Guardar estrutura do turno</Button>
              </form>}
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Ordem</th>
                      <th className="px-4 py-3">Início</th>
                      <th className="px-4 py-3">Fim</th>
                      <th className="px-4 py-3">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeSlots.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground italic">
                          Nenhum horário definido para este turno.
                        </td>
                      </tr>
                    ) : (
                      activeSlots.map(s => (
                        <tr key={s.id} className="hover:bg-muted/50 transition-all">
                          <td className="px-4 py-3 font-bold text-foreground">{s.ordem}º Tempo</td>
                          <td className="px-4 py-3 font-medium text-muted-foreground">{s.inicio}</td>
                          <td className="px-4 py-3 font-medium text-muted-foreground">{s.fim}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${s.is_intervalo ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                              {s.is_intervalo ? 'Intervalo' : 'Aula'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end"><Button type="button" tone="gold" onClick={onComplete} disabled={loading||loadError||savingSlot||!turnSlots.some(s=>!s.is_intervalo)}>Concluir configuração</Button></div>
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">Novo Tempo</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              O horário será aplicado de Segunda a Sexta no turno {TURNOS.find(t => t.id === activeTurno)?.label}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSlot} className="space-y-4 py-4">
            {(newSlotInvalid || newSlotConflict || localConflicts.length > 0) && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><div className="flex items-center gap-2 font-black"><AlertCircle className="h-4 w-4" /> Ajuste os conflitos antes de salvar</div>{newSlotInvalid && <p className="mt-1">A hora de início deve ser anterior à hora de fim.</p>}{newSlotConflict && <p className="mt-1">O novo tempo sobrepõe o {newSlotConflict.ordem}º tempo ({newSlotConflict.inicio}-{newSlotConflict.fim}).</p>}{localConflicts.map((conflict) => <p key={conflict} className="mt-1">{conflict}</p>)}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1">Ordem (Posição)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newSlot.ordem}
                  onChange={e => setNewSlot(v => ({ ...v, ordem: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-bold focus:border-amber focus:outline-none transition-all"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer py-2.5">
                  <input
                    type="checkbox"
                    checked={newSlot.is_intervalo}
                    onChange={e => setNewSlot(v => ({ ...v, is_intervalo: e.target.checked }))}
                    className="w-5 h-5 rounded border-border text-amber focus:ring-amber"
                  />
                  <span className="text-xs font-bold text-foreground">É Intervalo?</span>
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1">Hora Início</label>
                <input
                  type="time"
                  required
                  value={newSlot.inicio}
                  onChange={e => setNewSlot(v => ({ ...v, inicio: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-bold focus:border-amber focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1">Hora Fim</label>
                <input
                  type="time"
                  required
                  value={newSlot.fim}
                  onChange={e => setNewSlot(v => ({ ...v, fim: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-bold focus:border-amber focus:outline-none transition-all"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="font-bold">Cancelar</Button>
              <Button type="submit" tone="gold" loading={savingSlot} disabled={newSlotInvalid || Boolean(newSlotConflict) || localConflicts.length > 0} className="font-black px-8">Salvar Tempo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
