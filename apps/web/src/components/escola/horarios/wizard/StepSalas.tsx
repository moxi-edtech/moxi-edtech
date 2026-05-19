"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, School, Users, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackSystem";

interface Sala {
  id: string;
  nome: string;
  tipo: string | null;
  capacidade: number | null;
}

interface StepSalasProps {
  escolaId: string;
  onComplete: () => void;
}

export function StepSalas({ escolaId, onComplete }: StepSalasProps) {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const { success, error } = useToast();

  const fetchSalas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/salas`);
      const json = await res.json();
      if (json.ok) setSalas(json.items || []);
    } catch (e) {
      error("Falha ao carregar salas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalas();
  }, [escolaId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/salas`, {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          capacidade: capacidade ? parseInt(capacidade) : null,
          tipo: "sala",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSalas(prev => [...prev, json.item]);
        setNome("");
        setCapacidade("");
        success("Sala adicionada!");
      } else {
        error(json.error || "Falha ao adicionar sala.");
      }
    } catch (e) {
      error("Erro na requisição.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente remover esta sala?")) return;
    
    try {
      const res = await fetch(`/api/escolas/${escolaId}/salas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setSalas(prev => prev.filter(s => s.id !== id));
        success("Sala removida.");
      } else {
        error(json.error || "Falha ao remover sala.");
      }
    } catch (e) {
      error("Erro na requisição.");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
          <School className="h-8 w-8 text-klasse-gold" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Ambientes e Salas</h2>
          <p className="text-sm text-slate-500">Cadastre as salas de aula, laboratórios e outros espaços.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulário de Cadastro */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Nova Sala</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Nome da Sala</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Sala 01, Lab de Química..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/10 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Capacidade (Opcional)</label>
              <input
                type="number"
                value={capacidade}
                onChange={e => setCapacidade(e.target.value)}
                placeholder="Ex: 30"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/10 transition-all"
              />
            </div>
            <Button type="submit" tone="gold" className="w-full h-12 font-black gap-2" loading={saving}>
              <Plus className="w-5 h-5" /> Adicionar Sala
            </Button>
          </form>
        </div>

        {/* Listagem */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Salas Cadastradas ({salas.length})</h3>
          
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : salas.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center">
              <School className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400">Nenhuma sala cadastrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {salas.map(sala => (
                <div key={sala.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 hover:border-klasse-gold/50 transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                      <School className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{sala.nome}</p>
                      {sala.capacidade && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Users className="w-3 h-3" /> {sala.capacidade} alunos
                        </p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(sala.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-blue-700 leading-relaxed">
              Dica: Cadastrar as salas agora permite que o sistema valide automaticamente conflitos de espaço durante a montagem do quadro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
