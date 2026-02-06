"use client";

import { useMemo, useState } from "react";
import { Clock, Plus, Trash2, Coffee, Sun, Moon, Sunset, Save, Wand2, AlertCircle } from "lucide-react";

export type HorarioSlot = {
  id: string;
  turno_id: string;
  dia_semana: number;
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo?: boolean | null;
  nome?: string;
};

type Turno = {
  id: string;
  label: string;
};

type SlotsConfigProps = {
  turnos: Turno[];
  value: HorarioSlot[];
  onChange: (slots: HorarioSlot[]) => void;
  onSave?: () => void;
};

const DIAS = [
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
  { id: 6, label: "Sábado" },
];

const TURNOS_ICONS: Record<string, React.ElementType> = {
  matinal: Sun,
  tarde: Sunset,
  noite: Moon,
};

const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const addMinutes = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60000);

const buildSlot = (
  turnoId: string,
  dia: number,
  ordem: number,
  inicio: string,
  fim: string,
  isIntervalo: boolean,
  nome?: string
): HorarioSlot => ({
  id: crypto.randomUUID(),
  turno_id: turnoId,
  dia_semana: dia,
  ordem,
  inicio,
  fim,
  is_intervalo: isIntervalo,
  nome,
});

export function SlotsConfig({ turnos, value, onChange, onSave }: SlotsConfigProps) {
  const [activeTurno, setActiveTurno] = useState(turnos[0]?.id ?? "");
  const [activeDia, setActiveDia] = useState(DIAS[0]?.id ?? 1);
  const [inicioTurno, setInicioTurno] = useState("07:30");
  const [duracaoAula, setDuracaoAula] = useState(45);
  const [qtdTempos, setQtdTempos] = useState(6);
  const [usaIntervalo, setUsaIntervalo] = useState(true);
  const [intervaloApos, setIntervaloApos] = useState(3);
  const [duracaoIntervalo, setDuracaoIntervalo] = useState(20);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, HorarioSlot[]>();
    for (const slot of value.filter((item) => item.turno_id === activeTurno)) {
      const list = map.get(slot.dia_semana) ?? [];
      list.push(slot);
      map.set(slot.dia_semana, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.ordem - b.ordem);
    }
    return map;
  }, [value, activeTurno]);

  const currentSlots = slotsByDay.get(activeDia) ?? [];

  const updateSlots = (nextSlots: HorarioSlot[]) => {
    onChange(value.filter((slot) => slot.turno_id !== activeTurno || slot.dia_semana !== activeDia).concat(nextSlots));
  };

  const removeSlot = (slotId: string) => {
    updateSlots(currentSlots.filter((slot) => slot.id !== slotId));
  };

  const insertIntervalAfter = (slotIndex: number) => {
    const baseSlot = currentSlots[slotIndex];
    if (!baseSlot) return;
    const nextOrdem = baseSlot.ordem + 1;
    const start = baseSlot.fim;
    const startDate = new Date(`2000-01-01T${start}`);
    const endDate = addMinutes(startDate, duracaoIntervalo);
    const intervalSlot = buildSlot(
      activeTurno,
      activeDia,
      nextOrdem,
      formatTime(startDate),
      formatTime(endDate),
      true,
      "Intervalo / Recreio"
    );
    const updated = [...currentSlots, intervalSlot]
      .map((slot) => (slot.ordem >= nextOrdem && slot.id !== intervalSlot.id ? { ...slot, ordem: slot.ordem + 1 } : slot))
      .sort((a, b) => a.ordem - b.ordem);
    updateSlots(updated);
  };

  const gerarGradeAutomatica = () => {
    const baseDate = new Date(`2000-01-01T${inicioTurno}`);
    let currentTime = baseDate;
    const newSlots: HorarioSlot[] = [];
    let aulaCount = 1;

    for (let i = 1; i <= qtdTempos; i += 1) {
      const fimAula = addMinutes(currentTime, duracaoAula);
      newSlots.push(
        buildSlot(
          activeTurno,
          activeDia,
          newSlots.length + 1,
          formatTime(currentTime),
          formatTime(fimAula),
          false,
          `${aulaCount}º Tempo`
        )
      );
      currentTime = fimAula;
      aulaCount += 1;

      if (usaIntervalo && i === intervaloApos) {
        const fimIntervalo = addMinutes(currentTime, duracaoIntervalo);
        newSlots.push(
          buildSlot(
            activeTurno,
            activeDia,
            newSlots.length + 1,
            formatTime(currentTime),
            formatTime(fimIntervalo),
            true,
            "Intervalo / Recreio"
          )
        );
        currentTime = fimIntervalo;
      }
    }

    updateSlots(newSlots);
  };

  const activeTurnoConfig = turnos.find((turno) => turno.id === activeTurno);
  const turnoLabel = activeTurnoConfig?.label ?? "Turno";
  const TurnoIcon = TURNOS_ICONS[activeTurno] ?? Clock;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estrutura de Horários</h1>
        <p className="text-slate-500 text-sm">
          Defina os tempos de aula e intervalos para cada turno. Isso será a base do gerador automático.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {turnos.map((turno) => {
          const Icon = TURNOS_ICONS[turno.id] ?? Clock;
          const aulasCount = value.filter(
            (slot) => slot.turno_id === turno.id && !slot.is_intervalo
          ).length;
          return (
            <button
              key={turno.id}
              onClick={() => setActiveTurno(turno.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTurno === turno.id
                  ? "border-emerald-600 text-emerald-800 bg-emerald-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {turno.label}
              <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-[10px] text-slate-600">
                {aulasCount} Aulas
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {DIAS.map((dia) => (
          <button
            key={dia.id}
            type="button"
            onClick={() => setActiveDia(dia.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              activeDia === dia.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {dia.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-7 space-y-4">
          {currentSlots.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center justify-center text-slate-400">
              <Clock className="w-12 h-12 mb-3 text-slate-300" />
              <p className="font-medium">Nenhum tempo configurado</p>
              <p className="text-xs">Use o gerador ao lado para começar rápido.</p>
            </div>
          ) : (
            <div className="relative pl-8 border-l-2 border-slate-200 space-y-6 py-2">
              {currentSlots.map((slot, idx) => (
                <div key={slot.id} className="relative group">
                  <div
                    className={`absolute -left-[41px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-4 border-white shadow-sm z-10 ${
                      slot.is_intervalo ? "bg-amber-400" : "bg-emerald-500"
                    }`}
                  />
                  <div
                    className={`flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${
                      slot.is_intervalo ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          slot.is_intervalo
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {slot.is_intervalo ? (
                          <Coffee className="w-5 h-5" />
                        ) : (
                          <span className="font-bold text-lg">{idx + 1}º</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {slot.nome ?? `${idx + 1}º Tempo`}
                        </div>
                        <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                          <span className="bg-slate-100 px-1.5 rounded">{slot.inicio}</span>
                          <span className="text-slate-300">➜</span>
                          <span className="bg-slate-100 px-1.5 rounded">{slot.fim}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeSlot(slot.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {!slot.is_intervalo && idx < currentSlots.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => insertIntervalAfter(idx)}
                      className="mt-2 ml-12 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600"
                    >
                      <Coffee className="h-3 w-3" />
                      Adicionar intervalo aqui
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg sticky top-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Wand2 className="w-4 h-4 text-emerald-600" />
              Gerador Rápido · {turnoLabel}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Início do Turno
                </label>
                <input
                  type="time"
                  value={inicioTurno}
                  onChange={(event) => setInicioTurno(event.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Duração Aula
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={duracaoAula}
                      onChange={(event) => setDuracaoAula(Number(event.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">min</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Qtd. Tempos
                  </label>
                  <input
                    type="number"
                    value={qtdTempos}
                    onChange={(event) => setQtdTempos(Number(event.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Adicionar Intervalo?</label>
                  <input
                    type="checkbox"
                    checked={usaIntervalo}
                    onChange={(event) => setUsaIntervalo(event.target.checked)}
                    className="accent-emerald-600"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Após o</span>
                  <input
                    type="number"
                    value={intervaloApos}
                    onChange={(event) => setIntervaloApos(Number(event.target.value))}
                    className="w-12 p-1 border rounded text-center"
                  />
                  <span>º tempo, durando</span>
                  <input
                    type="number"
                    value={duracaoIntervalo}
                    onChange={(event) => setDuracaoIntervalo(Number(event.target.value))}
                    className="w-12 p-1 border rounded text-center"
                  />
                  <span>min</span>
                </div>
              </div>

              <button
                onClick={gerarGradeAutomatica}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" /> Gerar Grade
              </button>

              <hr className="border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  const nextOrdem = currentSlots.length + 1;
                  const manualSlot = buildSlot(
                    activeTurno,
                    activeDia,
                    nextOrdem,
                    "07:30",
                    "08:15",
                    false,
                    `${nextOrdem}º Tempo`
                  );
                  updateSlots([...currentSlots, manualSlot]);
                }}
                className="w-full border border-slate-200 text-slate-600 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar Manualmente
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onSave}
            className="w-full mt-4 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" /> Salvar Configuração
          </button>

          {!onSave ? (
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Conecte o botão de salvar à API de horários.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
