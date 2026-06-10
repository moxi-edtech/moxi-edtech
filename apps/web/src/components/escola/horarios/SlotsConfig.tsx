"use client";

import { useMemo, useState } from "react";
import { 
  Clock, Plus, Trash2, Coffee, Sun, Moon, Sunset, 
  Save, Wand2, ArrowRight, Settings2, MoreVertical 
} from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

// --- TYPES (Mantidos) ---
export type HorarioSlot = {
  id: string;
  turno_id: string;
  dia_semana: number; // 1 = Segunda
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo?: boolean | null;
  nome?: string;
};

// --- CONSTANTS ---
const TURNOS = [
    { id: "matinal", label: "Matinal", icon: Sun, color: "text-klasse-gold-500 bg-klasse-gold-50" },
    { id: "tarde", label: "Vespertino", icon: Sunset, color: "text-orange-500 bg-orange-50" },
    { id: "noite", label: "Noturno", icon: Moon, color: "text-indigo-500 bg-indigo-50" },
];

const DIAS = [
  { id: 1, label: "Segunda", short: "Seg" },
  { id: 2, label: "Terça", short: "Ter" },
  { id: 3, label: "Quarta", short: "Qua" },
  { id: 4, label: "Quinta", short: "Qui" },
  { id: 5, label: "Sexta", short: "Sex" },
  { id: 6, label: "Sábado", short: "Sáb" },
];

// --- COMPONENT ---
export function SlotsConfig({ value, onChange, onSave }: any) {
  const { success } = useToast();
  const [activeTurno, setActiveTurno] = useState("matinal");
  const [activeDia, setActiveDia] = useState(1);
  const [showGenerator, setShowGenerator] = useState(false); // Esconde o gerador por padrão

  const timeToMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN;
    return hour * 60 + minute;
  };

  // Filtra slots do dia/turno atual
  const currentSlots = useMemo(() => {
    return value
      .filter((s: HorarioSlot) => s.turno_id === activeTurno && s.dia_semana === activeDia)
      .sort((a: any, b: any) => a.ordem - b.ordem);
  }, [value, activeTurno, activeDia]);

  const slotIssues = useMemo(() => {
    const invalid = new Set<string>();
    const overlap = new Set<string>();
    const normalSlots = currentSlots.filter((slot) => !slot.is_intervalo);

    for (const slot of currentSlots) {
      const start = timeToMinutes(slot.inicio);
      const end = timeToMinutes(slot.fim);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
        invalid.add(slot.id);
      }
    }

    for (let i = 0; i < normalSlots.length; i += 1) {
      const a = normalSlots[i];
      const aStart = timeToMinutes(a.inicio);
      const aEnd = timeToMinutes(a.fim);
      if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) continue;
      for (let j = i + 1; j < normalSlots.length; j += 1) {
        const b = normalSlots[j];
        const bStart = timeToMinutes(b.inicio);
        const bEnd = timeToMinutes(b.fim);
        if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) continue;
        if (aStart < bEnd && bStart < aEnd) {
          overlap.add(a.id);
          overlap.add(b.id);
        }
      }
    }

    return { invalid, overlap };
  }, [currentSlots]);

  // Actions
  const handleRemove = (id: string) => {
    onChange(value.filter((s: HorarioSlot) => s.id !== id));
    success("Tempo removido.");
  };

  const handleApplyGenerator = (newSlots: HorarioSlot[]) => {
      // Remove slots existentes desse dia/turno e adiciona os novos
      const cleanList = value.filter((s: HorarioSlot) => 
         !(s.turno_id === activeTurno && s.dia_semana === activeDia)
      );
      onChange([...cleanList, ...newSlots]);
      setShowGenerator(false);
      success("Grade gerada com sucesso.");
  };

  const currentTurnoData = TURNOS.find(t => t.id === activeTurno);
  const TurnoIcon = currentTurnoData?.icon || Sun;

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sora text-slate-900">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-slate-900">Estrutura de Horários</h1>
           <p className="text-slate-500 text-sm mt-1">Configure a duração das aulas e intervalos por turno.</p>
        </div>
        
        <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowGenerator(!showGenerator)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all
                   ${showGenerator 
                      ? "bg-slate-100 text-slate-900" 
                      : "bg-white border border-slate-200 text-slate-700 hover:border-klasse-gold"
                   }
                `}
             >
                <Wand2 className="w-4 h-4 text-klasse-gold" />
                {showGenerator ? "Fechar Gerador" : "Gerador Mágico"}
             </button>
             
             <button 
                onClick={onSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-klasse-gold text-white font-bold text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all"
             >
                <Save className="w-4 h-4" />
                Salvar Tudo
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
         
         {/* SIDEBAR: SELETORES */}
         <div className="md:col-span-3 space-y-6">
            {/* Turnos */}
            <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm space-y-1">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2 block">Turno</span>
               {TURNOS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTurno(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all
                       ${activeTurno === t.id 
                          ? "bg-slate-900 text-white shadow-md" 
                          : "text-slate-500 hover:bg-slate-50"
                       }
                    `}
                  >
                     <t.icon className={`w-4 h-4 ${activeTurno === t.id ? "text-klasse-gold" : "text-slate-400"}`} />
                     {t.label}
                  </button>
               ))}
            </div>

            {/* Dias */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Dia da Semana</span>
                <div className="grid grid-cols-3 gap-2">
                   {DIAS.map(d => (
                      <button
                         key={d.id}
                         onClick={() => setActiveDia(d.id)}
                         className={`py-2 rounded-lg text-xs font-bold transition-all border
                            ${activeDia === d.id 
                               ? "bg-klasse-gold border-klasse-gold text-white" 
                               : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
                            }
                         `}
                      >
                         {d.short}
                      </button>
                   ))}
                </div>
            </div>
         </div>

         {/* MAIN: TIMELINE */}
         <div className="md:col-span-9">
            {showGenerator ? (
               <GeradorPanel 
                  turno={activeTurno} 
                  dia={activeDia} 
                  onGenerate={handleApplyGenerator} 
                  onCancel={() => setShowGenerator(false)}
               />
            ) : (
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
                  {/* Header da Timeline */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${currentTurnoData?.color}`}>
                           <TurnoIcon className="w-5 h-5" />
                        </div>
                        <div>
                           <h2 className="text-lg font-bold text-slate-900">
                              {currentTurnoData?.label} • {DIAS.find(d => d.id === activeDia)?.label}
                           </h2>
                           <p className="text-xs text-slate-500">
                              {currentSlots.length} tempos configurados
                           </p>
                        </div>
                     </div>
                     <button className="text-xs font-bold text-klasse-gold hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Adicionar Tempo
                     </button>
                  </div>

                  {/* Lista de Slots */}
                  <div className="flex-1 p-6 space-y-0 relative">
                     {currentSlots.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 opacity-50">
                           <Clock className="w-16 h-16 mb-4 text-slate-200" />
                           <p>Nenhum horário definido para este dia.</p>
                           <button onClick={() => setShowGenerator(true)} className="mt-4 text-klasse-gold font-bold text-sm underline">
                              Usar Gerador Automático
                           </button>
                        </div>
                     ) : (
                        <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 py-4">
                           {currentSlots.map((slot: any, index: number) => (
                           <div key={slot.id} className="relative group">
                                 {/* Timeline Dot */}
                                 <div className={`
                                    absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-white shadow-sm z-10
                                    ${slot.is_intervalo ? "bg-klasse-gold-400" : "bg-klasse-gold"}
                                 `} />

                                 <div className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md hover:scale-[1.01]
                                    ${slot.is_intervalo 
                                       ? "bg-klasse-gold-50/50 border-klasse-gold-100" 
                                       : "bg-white border-slate-100"
                                    }
                                    ${slotIssues.invalid.has(slot.id) || slotIssues.overlap.has(slot.id)
                                       ? "border-rose-300 bg-rose-50/40"
                                       : ""
                                    }
                                 `}>
                                    <div className="flex items-center gap-5">
                                       <div className={`
                                          flex flex-col items-center justify-center w-12 h-12 rounded-lg border
                                          ${slot.is_intervalo ? "bg-white border-klasse-gold-200 text-klasse-gold-600" : "bg-slate-50 border-slate-200 text-slate-900"}
                                       `}>
                                          {slot.is_intervalo ? (
                                             <Coffee className="w-5 h-5" />
                                          ) : (
                                             <span className="font-bold text-lg">{index + 1}º</span>
                                          )}
                                       </div>
                                       
                                       <div>
                                          <div className="text-sm font-bold text-slate-900">
                                             {slot.nome || (slot.is_intervalo ? "Intervalo" : `${index + 1}º Aula`)}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                             <div className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono font-medium text-slate-600">
                                                {slot.inicio}
                                             </div>
                                             <ArrowRight className="w-3 h-3 text-slate-300" />
                                             <div className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono font-medium text-slate-600">
                                                {slot.fim}
                                             </div>
                                             {slotIssues.invalid.has(slot.id) && (
                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                                   Horário inválido
                                                </span>
                                             )}
                                             {!slotIssues.invalid.has(slot.id) && slotIssues.overlap.has(slot.id) && (
                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                                   Sobreposição
                                                </span>
                                             )}
                                          </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-slate-400 hover:text-klasse-gold hover:bg-klasse-gold-50 rounded-lg">
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => handleRemove(slot.id)}
                                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: GERADOR (Melhorado) ---
function GeradorPanel({ turno, dia, onGenerate, onCancel }: any) {
   const [config, setConfig] = useState({
      inicio: "07:30",
      duracao: 45, 
      qtd: 6,
      intervalo: true,
      intervaloApos: 3,
      duracaoIntervalo: 20,
      aplicarTodosDias: true
   });

   const addMinutes = (time: string, minutes: number) => {
      const [hourPart, minutePart] = time.split(":").map(Number);
      const total = hourPart * 60 + minutePart + minutes;
      const nextHour = Math.floor(total / 60) % 24;
      const nextMinute = total % 60;
      return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
   };

   const generatedPreview = useMemo(() => {
      const preview: Array<{ label: string, inicio: string, fim: string, is_intervalo: boolean }> = [];
      let currentStart = config.inicio;
      let ordem = 1;

      for (let i = 1; i <= config.qtd; i++) {
         const fim = addMinutes(currentStart, config.duracao);
         preview.push({ label: `${ordem}º Tempo`, inicio: currentStart, fim, is_intervalo: false });
         ordem++;
         currentStart = fim;

         if (config.intervalo && i === config.intervaloApos) {
            const intFim = addMinutes(currentStart, config.duracaoIntervalo);
            preview.push({ label: `Intervalo`, inicio: currentStart, fim: intFim, is_intervalo: true });
            ordem++;
            currentStart = intFim;
         }
      }
      return preview;
   }, [config]);

   const handleGenerate = () => {
      const buildId = () => crypto.randomUUID();
      const diasParaAplicar = config.aplicarTodosDias ? [1, 2, 3, 4, 5] : [dia];
      
      const allNewSlots: HorarioSlot[] = [];

      diasParaAplicar.forEach(d => {
         let currentStart = config.inicio;
         let ordem = 1;
         for (let i = 1; i <= config.qtd; i++) {
            const fim = addMinutes(currentStart, config.duracao);
            allNewSlots.push({
               id: buildId(),
               turno_id: turno,
               dia_semana: d,
               ordem,
               inicio: currentStart,
               fim,
               is_intervalo: false
            });
            ordem++;
            currentStart = fim;

            if (config.intervalo && i === config.intervaloApos) {
               const intFim = addMinutes(currentStart, config.duracaoIntervalo);
               allNewSlots.push({
                  id: buildId(),
                  turno_id: turno,
                  dia_semana: d,
                  ordem,
                  inicio: currentStart,
                  fim: intFim,
                  is_intervalo: true,
                  nome: "Intervalo"
               });
               ordem++;
               currentStart = intFim;
            }
         }
      });

      onGenerate(allNewSlots);
   };

   return (
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl border border-white/5 animate-in zoom-in-95 duration-300">
         <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 rounded-2xl bg-klasse-gold/20 flex items-center justify-center border border-klasse-gold/30">
                  <Wand2 className="w-6 h-6 text-klasse-gold" />
               </div>
               <div>
                  <h3 className="text-xl font-black tracking-tight">Gerador de Grade Base</h3>
                  <p className="text-xs text-slate-400 font-medium">Automatize a estrutura de tempos da sua escola.</p>
               </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500">
               <Settings2 className="w-5 h-5" />
            </button>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Controles */}
            <div className="lg:col-span-5 space-y-8">
               <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Hora de Início</label>
                        <input 
                           type="time" 
                           value={config.inicio}
                           onChange={e => setConfig({...config, inicio: e.target.value})}
                           className="w-full bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 ring-klasse-gold transition-all"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Duração Aula (min)</label>
                        <input 
                           type="number" 
                           value={config.duracao}
                           onChange={e => setConfig({...config, duracao: parseInt(e.target.value)})}
                           className="w-full bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 ring-klasse-gold transition-all"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Total de Aulas</label>
                        <input 
                           type="number" 
                           value={config.qtd}
                           onChange={e => setConfig({...config, qtd: parseInt(e.target.value)})}
                           className="w-full bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 ring-klasse-gold transition-all"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Minutos de Recreio</label>
                        <input 
                           type="number" 
                           value={config.duracaoIntervalo}
                           onChange={e => setConfig({...config, duracaoIntervalo: parseInt(e.target.value)})}
                           className="w-full bg-slate-800 border-0 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 ring-klasse-gold transition-all"
                        />
                     </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                     <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                           type="checkbox" 
                           checked={config.intervalo}
                           onChange={e => setConfig({...config, intervalo: e.target.checked})}
                           className="w-5 h-5 rounded-lg border-0 bg-slate-700 text-klasse-gold focus:ring-offset-slate-900"
                        />
                        <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Habilitar Intervalo (Recreio)</span>
                     </label>
                     
                     {config.intervalo && (
                        <div className="pl-8 flex items-center gap-3">
                           <span className="text-[10px] font-bold text-slate-500 uppercase">Após a</span>
                           <select 
                              value={config.intervaloApos}
                              onChange={e => setConfig({...config, intervaloApos: parseInt(e.target.value)})}
                              className="bg-slate-800 border-0 rounded-lg text-xs font-bold py-1 px-3 focus:ring-klasse-gold"
                           >
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}ª aula</option>)}
                           </select>
                        </div>
                     )}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group p-4 rounded-2xl bg-klasse-gold/5 border border-klasse-gold/10">
                     <input 
                        type="checkbox" 
                        checked={config.aplicarTodosDias}
                        onChange={e => setConfig({...config, aplicarTodosDias: e.target.checked})}
                        className="w-5 h-5 rounded-lg border-0 bg-slate-700 text-klasse-gold focus:ring-offset-slate-900"
                     />
                     <div className="flex flex-col">
                        <span className="text-xs font-black text-klasse-gold uppercase tracking-tight">Replicar Semana Inteira</span>
                        <span className="text-[9px] text-slate-500 font-bold">Aplica esta grade de Segunda a Sexta automaticamente.</span>
                     </div>
                  </label>
               </div>
            </div>

            {/* Live Preview */}
            <div className="lg:col-span-7 space-y-4">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Pré-visualização da Grade</label>
               <div className="bg-slate-800/50 rounded-3xl p-6 border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {generatedPreview.map((p, i) => (
                     <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${p.is_intervalo ? 'bg-klasse-gold/10 border-klasse-gold/20' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex items-center gap-3">
                           <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black ${p.is_intervalo ? 'bg-klasse-gold text-slate-900' : 'bg-white/10 text-slate-400'}`}>
                              {p.is_intervalo ? <Coffee size={14} /> : `${p.label.charAt(0)}º`}
                           </div>
                           <span className={`text-xs font-bold ${p.is_intervalo ? 'text-klasse-gold' : 'text-white'}`}>{p.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-400">
                           <span>{p.inicio}</span>
                           <ArrowRight size={10} />
                           <span>{p.fim}</span>
                        </div>
                     </div>
                  ))}
               </div>

               <button 
                  onClick={handleGenerate}
                  className="w-full py-5 bg-klasse-gold text-slate-900 font-black rounded-[2rem] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-klasse-gold/20 text-sm uppercase tracking-widest mt-4"
               >
                  Aplicar Estrutura de Horários
               </button>
            </div>
         </div>
      </div>
   );
}
