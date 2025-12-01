"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { 
  User, Calendar, Building, Wallet, CheckCircle2, 
  ArrowRight, Loader2, Search, X, GraduationCap, Clock, AlertCircle,
  BookOpen
} from "lucide-react";

// --- TIPOS MAIS FLEXÍVEIS ---
interface Aluno {
  id: string;
  nome: string;
  bilhete?: string;
  fotoUrl?: string;
}

interface Session {
  id: string;
  nome: string;
}

interface Turma {
  id: string;
  nome: string;
  turno?: string;
  
  // Variações possíveis de retorno da API
  classe_nome?: string; 
  classe?: { nome: string }; 
  classes?: { nome: string }; // Supabase às vezes retorna plural
  
  curso_nome?: string;
  curso?: { nome: string };
  cursos?: { nome: string }; // Supabase às vezes retorna plural
  
  ocupacao?: number;
  ocupacao_atual?: number;
  capacidade?: number;
  capacidade_maxima?: number;
}

export default function NovaMatriculaLean() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // --- ESTADOS ---
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [alunosList, setAlunosList] = useState<Aluno[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  const [alunoId, setAlunoId] = useState(searchParams?.get("alunoId") || "");
  const [sessionId, setSessionId] = useState("");
  const [turmaId, setTurmaId] = useState("");

  // --- MEMOS ---
  const alunoSelecionado = useMemo(() => 
    alunosList.find(a => a.id === alunoId), 
  [alunoId, alunosList]);

  const turmaSelecionada = useMemo(() => 
    turmas.find(t => t.id === turmaId), 
  [turmaId, turmas]);

  // --- DEBUGGER (Olha para o Console do Browser F12) ---
  useEffect(() => {
    if (turmaSelecionada) {
      console.log("🔎 DEBUG TURMA SELECIONADA:", turmaSelecionada);
    }
  }, [turmaSelecionada]);

  // --- HELPERS DE EXTRAÇÃO ROBUSTOS ---
  const getClasseLabel = (t?: Turma) => {
    if (!t) return "—";
    // Tenta todas as combinações possíveis
    const nome = t.classe?.nome || t.classes?.nome || t.classe_nome;
    return nome || "Classe não definida";
  };

  const getCursoLabel = (t?: Turma) => {
    if (!t) return "—";
    // Tenta todas as combinações possíveis
    const nome = t.curso?.nome || t.cursos?.nome || t.curso_nome;
    
    // Se ainda assim for null/undefined, assumimos Ensino Geral se não for técnico explicitamente
    return nome || "Ensino Geral";
  };

  const getTurnoLabel = (t?: Turma) => t?.turno || "Turno não definido";
  
  const getOcupacao = (t?: Turma) => {
    const atual = t?.ocupacao_atual ?? t?.ocupacao ?? 0;
    const max = t?.capacidade_maxima ?? t?.capacidade ?? 30;
    return `${atual}/${max}`;
  };

  const isTecnico = (t?: Turma) => {
    const nome = getCursoLabel(t).toLowerCase();
    return nome.includes('técnico') || nome.includes('tecnico') || nome.includes('saúde');
  };

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInit(true);
        const [resAlunos, resSessions] = await Promise.all([
          fetch("/api/secretaria/alunos?status=ativo"),
          fetch("/api/secretaria/school-sessions")
        ]);

        if (resAlunos.ok) {
          const json = await resAlunos.json();
          setAlunosList(json.data || json.items || []);
        }
        if (resSessions.ok) {
          const json = await resSessions.json();
          const items = json.data || json.items || [];
          setSessions(items);
          const active = items.find((s: any) => s.status === 'ativa');
          if (active) setSessionId(active.id);
          else if (items.length > 0) setSessionId(items[0].id);
        }
      } catch (error) {
        console.error("Erro loading:", error);
      } finally {
        setLoadingInit(false);
      }
    }
    loadData();
  }, []);

  // --- CARREGAR TURMAS ---
  useEffect(() => {
    async function loadTurmas() {
      if (!sessionId) {
        setTurmas([]);
        setTurmaId("");
        return;
      }
      try {
        const res = await fetch(`/api/secretaria/turmas-simples?session_id=${sessionId}`);
        if (res.ok) {
          const json = await res.json();
          // IMPORTANTE: O backend deve retornar 'classe: { nome: ... }' e 'curso: { nome: ... }'
          setTurmas(json.data || json.items || []);
        }
      } catch (error) {
        console.error(error);
      }
    }
    loadTurmas();
  }, [sessionId]);

  // --- SUBMIT ---
  const handleSubmit = async () => {
    if (!alunoId || !sessionId || !turmaId) return;
    setSubmitting(true);
    try {
      const payload = {
        aluno_id: alunoId,
        turma_id: turmaId,
        session_id: sessionId,
      };

      const res = await fetch("/api/secretaria/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao matricular");

      alert(`Matrícula Confirmada!\nNº Processo: ${json.data?.numero_matricula || 'Gerado'}`);
      router.back();

    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600"/>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <X className="w-5 h-5"/>
          </button>
          <h1 className="text-lg font-bold text-slate-800">Nova Matrícula</h1>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-teal-600 font-bold flex items-center gap-1"><User className="w-3 h-3"/> Seleção</span>
          <span className="w-4 h-px bg-slate-300"></span>
          <span className="text-teal-600 font-bold flex items-center gap-1"><Building className="w-3 h-3"/> Alocação</span>
          <span className="w-4 h-px bg-slate-300"></span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Confirmação</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-32 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            
            {/* 1. QUEM? */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">1</div>
                <h2 className="text-lg font-bold">Quem vamos matricular?</h2>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-400 transition-colors group">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-teal-500" />
                  <select 
                    value={alunoId}
                    onChange={(e) => setAlunoId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl appearance-none outline-none focus:ring-2 focus:ring-teal-500/20 font-medium cursor-pointer text-slate-700"
                  >
                    <option value="">Pesquisar aluno por nome ou BI...</option>
                    {alunosList.map(a => (
                      <option key={a.id} value={a.id}>{a.nome} (BI: {a.bilhete || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                {alunoSelecionado && (
                  <div className="mt-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-black text-2xl border-2 border-white shadow-sm">
                      {alunoSelecionado.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{alunoSelecionado.nome}</p>
                      <p className="text-sm text-slate-500">BI: {alunoSelecionado.bilhete || "Não informado"}</p>
                    </div>
                    <div className="ml-auto">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                          <CheckCircle2 size={12} /> Validado
                        </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. ONDE? */}
            <section className={`space-y-4 transition-all duration-500 ${!alunoId ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
              <div className="flex items-center gap-3 text-slate-800">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">2</div>
                <h2 className="text-lg font-bold">Para onde vai?</h2>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ano Letivo</label>
                    <select 
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      {sessions.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Turma de Destino</label>
                    <select 
                      value={turmaId}
                      onChange={(e) => setTurmaId(e.target.value)}
                      disabled={!sessionId}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{sessionId ? "Escolha a turma..." : "Aguardando ano..."}</option>
                      {turmas.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.nome} ({getOcupacao(t)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PREVIEW INTELIGENTE */}
                {turmaSelecionada && (
                  <div className="pt-6 border-t border-slate-100 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3">Detalhes Automáticos</p>
                    <div className="grid grid-cols-3 gap-4">
                        
                        <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-colors
                           ${isTecnico(turmaSelecionada) ? 'bg-purple-50 border-purple-100' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                            {isTecnico(turmaSelecionada) 
                              ? <BookOpen className="w-5 h-5 mx-auto text-purple-500 mb-2"/>
                              : <GraduationCap className="w-5 h-5 mx-auto text-indigo-400 mb-2"/>
                            }
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Curso</p>
                            <p className={`text-xs font-bold line-clamp-2 mt-0.5 ${isTecnico(turmaSelecionada) ? 'text-purple-900' : 'text-indigo-900'}`}>
                                {getCursoLabel(turmaSelecionada)}
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                            <Building className="w-5 h-5 mx-auto text-slate-400 mb-2"/>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Classe</p>
                            <p className="text-xs font-bold text-slate-900 mt-0.5">{getClasseLabel(turmaSelecionada)}</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                            <Clock className="w-5 h-5 mx-auto text-slate-400 mb-2"/>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Turno</p>
                            <p className="text-xs font-bold text-slate-900 mt-0.5 capitalize">{getTurnoLabel(turmaSelecionada)}</p>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </main>

        {/* COLUNA DIREITA: RESUMO */}
        <aside className="hidden lg:flex flex-col w-[380px] bg-white border-l border-slate-200 p-8 z-10 shadow-[-10px_0_40px_-20px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <Wallet className="w-6 h-6"/>
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Resumo</h3>
            </div>

            <div className="flex-1 space-y-6">
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Matrícula</span>
                        <span className="font-bold text-slate-900">5.000 Kz</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Cartão</span>
                        <span className="font-bold text-slate-900">2.500 Kz</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Seguro</span>
                        <span className="font-bold text-slate-900">1.000 Kz</span>
                    </div>
                    <div className="h-px bg-slate-100 my-2"></div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-400 uppercase">Total</span>
                        <span className="text-2xl font-black text-emerald-600">8.500 Kz</span>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed flex gap-3 border border-slate-100">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"/>
                    <p>Ao confirmar, o aluno será vinculado à turma e o débito será lançado na conta corrente automaticamente.</p>
                </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !alunoId || !turmaId}
              className={`
                w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1
                ${submitting || !alunoId || !turmaId 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'}
              `}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
              ) : (
                <>Confirmar Matrícula <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
        </aside>

        {/* MOBILE FOOTER */}
        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-50 flex flex-col gap-3 shadow-top">
             <div className="flex justify-between items-center px-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Total a Pagar</span>
                <span className="text-lg font-black text-emerald-600">8.500 Kz</span>
             </div>
             <button
                onClick={handleSubmit}
                disabled={submitting || !alunoId || !turmaId}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-slate-900 disabled:bg-slate-300 shadow-lg flex items-center justify-center gap-2"
              >
                Confirmar
              </button>
        </div>

      </div>
    </div>
  );
}