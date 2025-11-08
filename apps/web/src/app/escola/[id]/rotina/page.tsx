"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  id: string;
  name: string;
  start: string;
  end: string;
  teacher: string;
};

type Store = {
  [key: string]: {
    [day: string]: Slot[];
  };
};

const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

// SVG Icons
const SvgIcons = {
  back: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  download: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66675 6.66667L8.00008 10L11.3334 6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  trash: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M13 4V13C13 13.5523 12.5523 14 12 14H4C3.44772 14 3 13.5523 3 13V4H13Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  check: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13 4L6 12L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  clear: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  calendar: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6C2 4.89543 2.89543 4 4 4H16C17.1046 4 18 4.89543 18 6V16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V6Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 8H18" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
};

export default function RotinasPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [store, setStore] = useState<Store>({
    "1A": {
      Segunda: [
        { id: "1", name: "English 1st paper", start: "09:00", end: "09:50", teacher: "—" },
      ],
      Terça: [{ id: "2", name: "Physics", start: "09:00", end: "09:50", teacher: "—" }],
      Quarta: [],
      Quinta: [],
      Sexta: [],
    },
    "1B": { Segunda: [], Terça: [], Quarta: [], Quinta: [], Sexta: [] },
    "2A": { Segunda: [], Terça: [], Quarta: [], Quinta: [], Sexta: [] },
  });

  const [classeFiltro, setClasseFiltro] = useState("1A");

  // form states
  const [classe, setClasse] = useState("1");
  const [secao, setSecao] = useState("A");
  const [curso, setCurso] = useState("");
  const [dia, setDia] = useState("Segunda");
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("09:50");
  const [prof, setProf] = useState("");

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const overlaps = (a: Slot, b: Slot) =>
    toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curso.trim()) return;
    
    if (toMinutes(fim) <= toMinutes(inicio)) {
      alert("⚠ Fim não pode ser antes do início.");
      return;
    }
    
    const key = `${classe}${secao}`;
    const newSlot: Slot = {
      id: Date.now().toString(),
      name: curso.trim(),
      start: inicio,
      end: fim,
      teacher: prof.trim() || "—",
    };

    setIsSubmitting(true);
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 800));

    setStore((prev) => {
      const novo = { ...prev };
      if (!novo[key]) {
        novo[key] = { Segunda: [], Terça: [], Quarta: [], Quinta: [], Sexta: [] };
      }
      const dayList = [...(novo[key][dia] || [])];
      
      if (dayList.some((s) => overlaps(s, newSlot))) {
        alert("⚠ Conflito de horário detectado!");
        return prev;
      }
      
      dayList.push(newSlot);
      // Ordenar por horário de início
      dayList.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      novo[key][dia] = dayList;
      return { ...novo };
    });

    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Resetar apenas alguns campos
    setCurso("");
    setProf("");
    
    // Esconder mensagem de sucesso após 3 segundos
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleDeleteSlot = (dia: string, slotId: string) => {
    if (confirm("Tem certeza que deseja excluir este horário?")) {
      setStore(prev => ({
        ...prev,
        [classeFiltro]: {
          ...prev[classeFiltro],
          [dia]: prev[classeFiltro][dia].filter(slot => slot.id !== slotId)
        }
      }));
    }
  };

  const exportar = () => {
    const data = store[classeFiltro];
    const blob = new Blob(
      [JSON.stringify({ turma: classeFiltro, horarios: data }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rotina-${classeFiltro}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearForm = () => {
    setCurso("");
    setProf("");
    setInicio("09:00");
    setFim("09:50");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
            <SvgIcons.calendar />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Rotinas (Horários)</h2>
            <p className="text-sm text-gray-600">Gerencie os horários das turmas</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm"
          >
            <SvgIcons.back />
            <span>Voltar</span>
          </button>
          <select
            value={classeFiltro}
            onChange={(e) => setClasseFiltro(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200 shadow-sm"
          >
            <option value="1A">Classe 1 • Seção A</option>
            <option value="1B">Classe 1 • Seção B</option>
            <option value="2A">Classe 2 • Seção A</option>
          </select>
          <button
            onClick={exportar}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm"
          >
            <SvgIcons.download />
            <span>Exportar</span>
          </button>
        </div>
      </header>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-5 duration-300 shadow-sm">
          <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
            <SvgIcons.check />
          </div>
          <div>
            <div className="font-medium text-green-800">Horário adicionado com sucesso!</div>
            <div className="text-sm text-green-600">O novo horário foi salvo na grade.</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">Criar novo horário</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Classe</label>
                <select
                  value={classe}
                  onChange={(e) => setClasse(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                >
                  <option value="1">Classe 1</option>
                  <option value="2">Classe 2</option>
                  <option value="3">Classe 3</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Seção</label>
                <select
                  value={secao}
                  onChange={(e) => setSecao(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                >
                  <option value="A">Seção A</option>
                  <option value="B">Seção B</option>
                  <option value="C">Seção C</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Disciplina/Curso</label>
              <input
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                placeholder="Ex.: English 1st paper"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Dia da semana</label>
              <select
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
              >
                {dias.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Início</label>
                <input
                  type="time"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Fim</label>
                <input
                  type="time"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Professor (opcional)</label>
              <input
                value={prof}
                onChange={(e) => setProf(e.target.value)}
                placeholder="Ex.: Prof. Domingos Xpragata"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !curso.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-medium disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <SvgIcons.plus />
                    <span>Criar Horário</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm"
              >
                <SvgIcons.clear />
                <span>Limpar</span>
              </button>
            </div>
          </form>
        </section>

        {/* Quadro da turma */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quadro de Horários - {classeFiltro}</h3>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {Object.values(store[classeFiltro] || {}).flat().length} horários
            </span>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {dias.map((d) => (
              <div key={d} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                  {d}
                </div>
                <div className="space-y-2">
                  {(store[classeFiltro]?.[d] || []).length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Nenhum horário cadastrado para este dia
                    </div>
                  ) : (
                    (store[classeFiltro]?.[d] || []).map((slot) => (
                      <div
                        key={slot.id}
                        className="group relative bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-200 p-3 hover:from-sky-100 hover:to-blue-100 transition-all duration-200"
                      >
                        <button
                          onClick={() => handleDeleteSlot(d, slot.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200"
                          title="Excluir horário"
                        >
                          <SvgIcons.trash />
                        </button>
                        
                        <div className="font-semibold text-gray-900 pr-8">{slot.name}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-sky-700 bg-sky-100 px-2 py-1 rounded-full">
                            {slot.start} – {slot.end}
                          </span>
                          {slot.teacher && slot.teacher !== "—" && (
                            <span className="text-xs text-gray-600">{slot.teacher}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}