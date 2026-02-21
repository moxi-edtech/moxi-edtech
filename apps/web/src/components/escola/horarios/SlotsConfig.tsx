"use client";

import { useMemo, useState } from "react";
import { 
  Clock, Plus, Trash2, Coffee, Sun, Moon, Sunset, 
  Save, Wand2, ArrowRight, Settings2, MoreVertical 
} from "lucide-react";
import { toast } from "sonner"; // Feedback decente

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
    { id: "matinal", label: "Matinal", icon: Sun, color: "text-amber-500 bg-amber-50" },
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
  const [activeTurno, setActiveTurno] = useState("matinal");
  const [activeDia, setActiveDia] = useState(1);
  const [showGenerator, setShowGenerator] = useState(false); // Esconde o gerador por padrão

  // Filtra slots do dia/turno atual
  const currentSlots = useMemo(() => {
    return value
      .filter((s: HorarioSlot) => s.turno_id === activeTurno && s.dia_semana === activeDia)
      .sort((a: any, b: any) => a.ordem - b.ordem);
  }, [value, activeTurno, activeDia]);

  // Actions
  const handleRemove = (id: string) => {
    onChange(value.filter((s: HorarioSlot) => s.id !== id));
    toast.success("Tempo removido");
  };

  const handleApplyGenerator = (newSlots: HorarioSlot[]) => {
      // Remove slots existentes desse dia/turno e adiciona os novos
      const cleanList = value.filter((s: HorarioSlot) => 
         !(s.turno_id === activeTurno && s.dia_semana === activeDia)
      );
      onChange([...cleanList, ...newSlots]);
      setShowGenerator(false);
      toast.success("Grade gerada com sucesso!");
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
                                    ${slot.is_intervalo ? "bg-amber-400" : "bg-klasse-gold"}
                                 `} />

                                 <div className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md hover:scale-[1.01]
                                    ${slot.is_intervalo 
                                       ? "bg-amber-50/50 border-amber-100" 
                                       : "bg-white border-slate-100"
                                    }
                                 `}>
                                    <div className="flex items-center gap-5">
                                       <div className={`
                                          flex flex-col items-center justify-center w-12 h-12 rounded-lg border
                                          ${slot.is_intervalo ? "bg-white border-amber-200 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-900"}
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
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-slate-400 hover:text-klasse-gold hover:bg-amber-50 rounded-lg">
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

// --- SUB-COMPONENT: GERADOR (Isolado para limpeza) ---
function GeradorPanel({ turno, dia, onGenerate, onCancel }: any) {
   const [config, setConfig] = useState({
      inicio: "07:30",
      duracao: 45, // min
      qtd: 6,
      intervalo: true,
      intervaloApos: 3,
      duracaoIntervalo: 20
   });

   const addMinutes = (time: string, minutes: number) => {
      const [hourPart, minutePart] = time.split(":").map(Number);
      const total = hourPart * 60 + minutePart + minutes;
      const nextHour = Math.floor(total / 60) % 24;
      const nextMinute = total % 60;
      return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
   };

   const buildId = () => {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
         return crypto.randomUUID();
      }
      return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
   };

   const handleGenerate = () => {
      const slots: HorarioSlot[] = [];
      let currentStart = config.inicio;
      let ordem = 1;

      for (let index = 1; index <= config.qtd; index += 1) {
         const fim = addMinutes(currentStart, config.duracao);
         slots.push({
            id: buildId(),
            turno_id: turno,
            dia_semana: dia,
            ordem,
            inicio: currentStart,
            fim,
            is_intervalo: false,
         });
         ordem += 1;

         currentStart = fim;

         if (config.intervalo && index === config.intervaloApos) {
            const intervaloFim = addMinutes(currentStart, config.duracaoIntervalo);
            slots.push({
               id: buildId(),
               turno_id: turno,
               dia_semana: dia,
               ordem,
               inicio: currentStart,
               fim: intervaloFim,
               is_intervalo: true,
               nome: "Intervalo",
            });
            ordem += 1;
            currentStart = intervaloFim;
         }
      }

      onGenerate(slots);
   };

   return (
      <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-right-8 duration-500">
         <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
               <Wand2 className="w-5 h-5 text-klasse-gold" />
               Gerador Automático
            </h3>
            <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
         </div>

         <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
               <label className="text-xs font-bold text-slate-400 uppercase">Configuração Básica</label>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <span className="block text-xs mb-1 text-slate-300">Início</span>
                     <input 
                        type="time" 
                        value={config.inicio} 
                        onChange={e => setConfig({...config, inicio: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-klasse-gold outline-none" 
                     />
                  </div>
                  <div>
                     <span className="block text-xs mb-1 text-slate-300">Qtd. Aulas</span>
                     <input 
                        type="number" 
                        value={config.qtd} 
                        onChange={e => setConfig({...config, qtd: Number(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-klasse-gold outline-none" 
                     />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-xs font-bold text-slate-400 uppercase">Intervalo (Recreio)</label>
               <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <input 
                     type="checkbox" 
                     checked={config.intervalo} 
                     onChange={e => setConfig({...config, intervalo: e.target.checked})}
                     className="accent-klasse-gold h-4 w-4" 
                  />
                  <div className="text-xs text-slate-300">
                     Inserir <span className="text-white font-bold">{config.duracaoIntervalo}min</span> após a {config.intervaloApos}ª aula
                  </div>
               </div>
            </div>
         </div>

         <button 
            onClick={handleGenerate} // Conecte sua lógica aqui
            className="w-full py-4 bg-klasse-gold text-slate-900 font-bold rounded-xl hover:brightness-110 transition-all shadow-lg shadow-klasse-gold/20"
         >
            Gerar Grade para {DIAS.find(d => d.id === dia)?.label}
         </button>
      </div>
   );
}
