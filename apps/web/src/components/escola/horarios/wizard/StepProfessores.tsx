"use client";

import React, { useState, useEffect } from "react";
import { Users, UserPlus, Check, Info, AlertTriangle, Search, Plus, X } from "lucide-react";
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

interface Disciplina {
  id: string;
  nome: string;
  professor_id?: string | null;
  professor_nome?: string | null;
}

interface Professor {
  id: string;
  nome: string;
}

interface StepProfessoresProps {
  escolaId: string;
  turmaId?: string | null;
  onComplete: () => void;
}

export function StepProfessores({ escolaId, turmaId, onComplete }: StepProfessoresProps) {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const { success, error } = useToast();

  // Form de Novo Professor
  const [newProf, setNewProf] = useState({
    nome_completo: "",
    email: "",
    genero: "M" as "M" | "F",
    data_nascimento: "1990-01-01",
    numero_bi: "",
    habilitacoes: "Licenciatura",
    vinculo_contratual: "Efetivo",
    carga_horaria_maxima: 20
  });
  const [savingProf, setSavingProf] = useState(false);

  const fetchData = async () => {
    if (!turmaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [discRes, profRes] = await Promise.all([
        fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`),
        fetch(`/api/secretaria/professores?pageSize=200`),
      ]);
      const [discJson, profJson] = await Promise.all([discRes.json(), profRes.json()]);
      
      if (discJson.ok) setDisciplinas(discJson.items || []);
      if (profJson.ok) {
        setProfessores(
          (profJson.items || []).map((p: any) => ({
            id: p.user_id || p.id,
            nome: p.nome || "Professor sem nome",
          }))
        );
      }
    } catch (e) {
      error("Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [turmaId]);

  const handleAssign = async (disciplinaId: string, professorId: string) => {
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/atribuir-professor`, {
        method: "POST",
        body: JSON.stringify({
          disciplina_id: disciplinaId,
          professor_id: professorId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        const prof = professores.find(p => p.id === professorId);
        setDisciplinas(prev => prev.map(d => d.id === disciplinaId ? { ...d, professor_id: professorId, professor_nome: prof?.nome } : d));
        setAssigningId(null);
        success("Professor atribuído!");
      }
    } catch (e) {
      error("Erro ao atribuir professor.");
    }
  };

  const handleCreateProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProf(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/create`, {
        method: "POST",
        body: JSON.stringify(newProf),
      });
      const json = await res.json();
      if (json.ok) {
        success("Professor cadastrado e convidado!");
        setShowAddModal(false);
        // Reset form
        setNewProf({
          nome_completo: "",
          email: "",
          genero: "M",
          data_nascimento: "1990-01-01",
          numero_bi: "",
          habilitacoes: "Licenciatura",
          vinculo_contratual: "Efetivo",
          carga_horaria_maxima: 20
        });
        // Refresh list
        await fetchData();
      } else {
        error(json.error || "Falha ao criar professor.");
      }
    } catch (e) {
      error("Erro na requisição.");
    } finally {
      setSavingProf(false);
    }
  };

  if (!turmaId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-black text-slate-900">Turma não selecionada</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">
          Selecione uma turma no quadro de horários para atribuir professores.
        </p>
      </div>
    );
  }

  const filteredProfessores = professores.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
            <Users className="h-8 w-8 text-klasse-gold" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Atribuição Docente</h2>
            <p className="text-sm text-slate-500">Defina qual professor será responsável por cada disciplina.</p>
          </div>
        </div>
        <Button 
          tone="gold" 
          variant="outline" 
          onClick={() => setShowAddModal(true)} 
          className="gap-2 font-black border-2"
        >
          <Plus className="w-4 h-4" /> Novo Professor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lista de Disciplinas */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Disciplinas da Turma</h3>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 w-full rounded-2xl bg-slate-50 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {disciplinas.map(disc => (
                <div 
                  key={disc.id} 
                  onClick={() => setAssigningId(disc.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                    assigningId === disc.id 
                      ? "bg-klasse-gold/5 border-klasse-gold ring-1 ring-klasse-gold" 
                      : "bg-white border-slate-200 hover:border-klasse-gold/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${disc.professor_id ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      {disc.professor_id ? <Check className="h-5 w-5 text-emerald-500" /> : <Users className="h-5 w-5 text-slate-300" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{disc.nome}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${disc.professor_id ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {disc.professor_nome || "Sem professor atribuído"}
                      </p>
                    </div>
                  </div>
                  <UserPlus className={`w-5 h-5 ${assigningId === disc.id ? 'text-klasse-gold' : 'text-slate-300'}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seletor de Professores */}
        <div className={`transition-all duration-300 ${assigningId ? 'opacity-100 translate-x-0' : 'opacity-50 translate-x-4 pointer-events-none'}`}>
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm sticky top-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">
              Selecionar Professor
            </h3>
            
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar professor..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/10 transition-all"
              />
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {filteredProfessores.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-400 mb-4">Nenhum professor encontrado.</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)} className="text-klasse-gold font-bold">
                    Cadastrar "{searchTerm}"?
                  </Button>
                </div>
              ) : (
                filteredProfessores.map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => assigningId && handleAssign(assigningId, prof.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-left transition-all group"
                  >
                    <span className="text-sm font-bold text-slate-700 group-hover:text-klasse-gold">{prof.nome}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))
              )}
            </div>

            {!assigningId && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-3xl z-20">
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                  Escolha uma disciplina primeiro
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo Professor */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Novo Professor</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              O professor receberá um e-mail para ativar o acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProfessor} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newProf.nome_completo}
                  onChange={e => setNewProf(v => ({ ...v, nome_completo: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">E-mail Institucional</label>
                <input
                  type="email"
                  required
                  value={newProf.email}
                  onChange={e => setNewProf(v => ({ ...v, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Gênero</label>
                <select
                  value={newProf.genero}
                  onChange={e => setNewProf(v => ({ ...v, genero: e.target.value as "M" | "F" }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Nº BI (14 chars)</label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  value={newProf.numero_bi}
                  onChange={e => setNewProf(v => ({ ...v, numero_bi: e.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold focus:border-klasse-gold focus:outline-none transition-all"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="font-bold">Cancelar</Button>
              <Button type="submit" tone="gold" loading={savingProf} className="font-black px-8">Salvar e Convidar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { ChevronRight as ChevronRightIcon } from "lucide-react";
const ChevronRight = ChevronRightIcon;
