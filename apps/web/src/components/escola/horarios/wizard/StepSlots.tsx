"use client";

import React, { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Wand2, Info, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

function formatSlotSaveError(json: any) {
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

export function StepSlots({ escolaId, onComplete }: StepSlotsProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTurno, setActiveTurno] = useState("matinal");
  const [showAddModal, setShowAddModal] = useState(false);
  const { success, error } = useToast();

  const [newSlot, setNewSlot] = useState({
    inicio: "07:15",
    fim: "08:05",
    is_intervalo: false,
    ordem: 1
  });
  const [savingSlot, setSavingSlot] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`);
      const json = await res.json();
      if (json.ok) setSlots(json.items || []);
    } catch (e) {
      error("Falha ao carregar horários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [escolaId]);

  const handleAutoGenerate = async () => {
    const defaults = [
      { ordem: 1, inicio: "07:15", fim: "08:05" },
      { ordem: 2, inicio: "08:05", fim: "08:55" },
      { ordem: 3, inicio: "08:55", fim: "09:45" },
      { ordem: 4, inicio: "10:00", fim: "10:50", is_intervalo: true },
      { ordem: 5, inicio: "10:50", fim: "11:40" },
    ];

    const payload = defaults.map(d => ({
      ...d,
      turno_id: activeTurno,
      dia_semana: 1, // Base para geração
      is_intervalo: d.is_intervalo || false
    }));

    // Replicar para todos os dias da semana
    const fullPayload: any[] = [];
    for (let d = 1; d <= 5; d++) {
      payload.forEach(p => fullPayload.push({ ...p, dia_semana: d }));
    }

    setSavingSlot(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
        method: "POST",
        body: JSON.stringify({ slots: fullPayload }),
      });
      const json = await res.json();
      if (json.ok) {
        success("Grade padrão gerada para toda a semana!");
        await fetchSlots();
      } else {
        error(formatSlotSaveError(json));
      }
    } catch (e) {
      error("Erro na rede.");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (e) {
      error("Erro na rede.");
    } finally {
      setSavingSlot(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
            <Clock className="h-8 w-8 text-klasse-gold" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Grade de Tempos</h2>
            <p className="text-sm text-slate-500">Defina os horários de início e fim de cada tempo de aula.</p>
          </div>
        </div>
        <Button 
          tone="gold" 
          variant="outline" 
          onClick={() => setShowAddModal(true)} 
          className="gap-2 font-black border-2"
        >
          <Plus className="w-4 h-4" /> Novo Tempo
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-6">
        <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50/50">
          {TURNOS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTurno(t.id)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTurno === t.id 
                  ? "bg-white text-klasse-gold shadow-sm ring-1 ring-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-12 w-full rounded-xl bg-slate-50 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Configuração de {TURNOS.find(t => t.id === activeTurno)?.label}</h3>
                <Button variant="outline" size="sm" onClick={handleAutoGenerate} disabled={savingSlot} className="gap-2 text-[10px] font-black uppercase tracking-widest border-2">
                  <Wand2 className="w-3.5 h-3.5" /> Gerar Padrão (MED)
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Ordem</th>
                      <th className="px-4 py-3">Início</th>
                      <th className="px-4 py-3">Fim</th>
                      <th className="px-4 py-3">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {slots.filter(s => s.turno_id === activeTurno && s.dia_semana === 1).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400 italic">
                          Nenhum horário definido para este turno.
                        </td>
                      </tr>
                    ) : (
                      slots.filter(s => s.turno_id === activeTurno && s.dia_semana === 1)
                        .sort((a,b) => a.ordem - b.ordem)
                        .map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3 font-bold text-slate-900">{s.ordem}º Tempo</td>
                          <td className="px-4 py-3 font-medium text-slate-600">{s.inicio}</td>
                          <td className="px-4 py-3 font-medium text-slate-600">{s.fim}</td>
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

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Novo Tempo</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              O horário será aplicado de Segunda a Sexta no turno {TURNOS.find(t => t.id === activeTurno)?.label}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSlot} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Ordem (Posição)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newSlot.ordem}
                  onChange={e => setNewSlot(v => ({ ...v, ordem: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer py-2.5">
                  <input
                    type="checkbox"
                    checked={newSlot.is_intervalo}
                    onChange={e => setNewSlot(v => ({ ...v, is_intervalo: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="text-xs font-bold text-slate-700">É Intervalo?</span>
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Hora Início</label>
                <input
                  type="time"
                  required
                  value={newSlot.inicio}
                  onChange={e => setNewSlot(v => ({ ...v, inicio: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Hora Fim</label>
                <input
                  type="time"
                  required
                  value={newSlot.fim}
                  onChange={e => setNewSlot(v => ({ ...v, fim: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="font-bold">Cancelar</Button>
              <Button type="submit" tone="gold" loading={savingSlot} className="font-black px-8">Salvar Tempo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
