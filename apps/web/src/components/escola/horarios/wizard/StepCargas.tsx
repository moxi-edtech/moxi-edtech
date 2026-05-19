"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Edit2, Check, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackSystem";

interface Disciplina {
  id: string;
  nome: string;
  carga_horaria_semanal: number;
  entra_no_horario: boolean;
}

interface StepCargasProps {
  escolaId: string;
  turmaId?: string | null;
  onComplete: () => void;
}

export function StepCargas({ escolaId, turmaId, onComplete }: StepCargasProps) {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { success, error } = useToast();

  const fetchDisciplinas = async () => {
    if (!turmaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`);
      const json = await res.json();
      if (json.ok) {
        setDisciplinas(json.items || []);
      }
    } catch (e) {
      error("Falha ao carregar disciplinas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplinas();
  }, [turmaId]);

  const handleUpdateCarga = async (id: string) => {
    const value = parseInt(editValue);
    if (isNaN(value)) return;

    try {
      const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ carga_horaria_semanal: value }),
      });
      const json = await res.json();
      if (json.ok) {
        setDisciplinas(prev => prev.map(d => d.id === id ? { ...d, carga_horaria_semanal: value } : d));
        setEditingId(null);
        success("Carga horária atualizada!");
      }
    } catch (e) {
      error("Erro ao atualizar.");
    }
  };

  if (!turmaId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-black text-slate-900">Turma não selecionada</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">
          Selecione uma turma no quadro de horários para configurar as cargas horárias.
        </p>
      </div>
    );
  }

  const totalAulas = disciplinas.reduce((acc, d) => acc + (d.carga_horaria_semanal || 0), 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
          <BookOpen className="h-8 w-8 text-klasse-gold" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Cargas Horárias</h2>
          <p className="text-sm text-slate-500">Confirme quantas aulas por semana cada disciplina deve ter.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Matriz Curricular da Turma</h3>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-slate-50 animate-pulse" />)}
            </div>
          ) : disciplinas.length === 0 ? (
            <div className="p-10 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 italic">
              Nenhuma disciplina encontrada para esta turma.
            </div>
          ) : (
            <div className="space-y-3">
              {disciplinas.map(disc => (
                <div key={disc.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{disc.nome}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {disc.carga_horaria_semanal || 0} aulas por semana
                      </p>
                    </div>
                  </div>

                  {editingId === disc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-16 rounded-lg border border-klasse-gold px-2 py-1 text-sm font-bold focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleUpdateCarga(disc.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingId(disc.id);
                        setEditValue(String(disc.carga_horaria_semanal || 0));
                      }}
                      className="p-2 text-slate-300 hover:text-klasse-gold hover:bg-klasse-gold/5 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Resumo da Matriz</h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-black">{totalAulas}</span>
              <span className="text-sm font-bold opacity-80">aulas/semana</span>
            </div>
            <p className="text-[11px] opacity-60 leading-relaxed mt-4">
              O quadro de horários desta turma deverá conter exatamente {totalAulas} blocos distribuídos entre Segunda e Sexta.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-blue-700 leading-relaxed">
              Dica: Certifique-se que o total de aulas não ultrapassa o número de tempos disponíveis no turno (Passo anterior).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
