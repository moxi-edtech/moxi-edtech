"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { formatTurmaName } from "@/utils/formatters";

interface TurmaFormProps {
  onSuccess: () => void;
}

interface ItemSelect {
  id: string;
  nome: string;
}

export default function TurmaForm({ onSuccess }: TurmaFormProps) {
  // --- ESTADOS ---
  const [nome, setNome] = useState("");
  const [turmaCodigo, setTurmaCodigo] = useState("");
  const [turno, setTurno] = useState("");
  const [sessionId, setSessionId] = useState(""); // ID da Sessão
  const [sala, setSala] = useState("");
  const [capacidade, setCapacidade] = useState(30);
  
  // Vínculos Académicos (Para a turma ser inteligente)
  const [cursoId, setCursoId] = useState("");
  const [classeId, setClasseId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listas para Selects
  const [sessions, setSessions] = useState<ItemSelect[]>([]);
  const [cursos, setCursos] = useState<ItemSelect[]>([]);
  const [classes, setClasses] = useState<ItemSelect[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [nomeSugestao, setNomeSugestao] = useState<string | null>(null);

  const classeSelecionada = classes.find((c) => c.id === classeId);
  const classeNumero = useMemo(() => {
    if (!classeSelecionada?.nome) return null;
    const digits = classeSelecionada.nome.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : null;
  }, [classeSelecionada]);

  const requiresCourse = classeNumero !== null && classeNumero >= 10;

  // --- CARREGAMENTO DE DADOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        
        // Carregamos tudo em paralelo para ser rápido
        const [resSessions, resCursos, resClasses] = await Promise.all([
          fetch("/api/secretaria/school-sessions"),
          fetch("/api/secretaria/cursos"), // Precisas ter este endpoint simples
          fetch("/api/secretaria/classes") // E este
        ]);

        const jsonSessions = await resSessions.json();
        const jsonCursos = await resCursos.json();
        const jsonClasses = await resClasses.json();

        if (jsonSessions.ok) setSessions(jsonSessions.data || jsonSessions.items || []);
        if (jsonCursos.ok) setCursos(jsonCursos.data || jsonCursos.items || []);
        if (jsonClasses.ok) setClasses(jsonClasses.data || jsonClasses.items || []);

        // Pré-selecionar sessão ativa se houver
        const active = (jsonSessions.data || []).find((s: any) => s.status === 'ativa');
        if (active) setSessionId(active.id);

      } catch (e) {
        console.error("Erro ao carregar dados:", e);
        setError("Não foi possível carregar as listas de seleção.");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // --- SUGESTÃO AUTOMÁTICA DE NOME ---
  useEffect(() => {
    const shouldSuggest = classeId && turno && sessionId;
    if (!shouldSuggest) {
      setNomeSugestao(null);
      return;
    }

    const controller = new AbortController();
    const fetchSuggestion = async () => {
      try {
        const sessionObj = sessions.find((s) => s.id === sessionId);
        const anoLetivoLabel = sessionObj?.nome;
        const params = new URLSearchParams({ classe_id: classeId, turno });
        if (anoLetivoLabel) params.set('ano_letivo', anoLetivoLabel);
        params.set('session_id', sessionId);

        const res = await fetch(`/api/secretaria/turmas/sugestao-nome?${params.toString()}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok || !json?.ok) return;

        const suggested = (json.suggested || '').toString().trim();
        if (suggested) {
          setNomeSugestao(suggested);
          if (!nome) setNome(suggested);
        }
      } catch (e) {
        if (!controller.signal.aborted) setNomeSugestao(null);
      }
    };

    fetchSuggestion();
    return () => controller.abort();
  }, [classeId, turno, sessionId, nome, sessions]);

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (requiresCourse && !cursoId) {
        throw new Error("Curso é obrigatório para turmas de 10ª classe ou acima.");
      }

      // 1. Encontrar o ano letivo numérico para o payload
      const sessionObj = sessions.find(s => s.id === sessionId);
      const anoLetivoInt = sessionObj?.nome ? parseInt(sessionObj.nome.replace(/\D/g, ''), 10) : new Date().getFullYear();

      const payload = {
        nome,
        turma_codigo: turmaCodigo,
        turno,
        session_id: sessionId,
        ano_letivo: anoLetivoInt, // O número (Correto)
        sala: sala || null,
        capacidade_maxima: Number(capacidade),
        curso_id: cursoId || null,
        classe_id: classeId || null
      };

      const res = await fetch("/api/secretaria/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar turma");
      }

      onSuccess(); // Fecha o modal e recarrega a lista
    } catch (e: any) {
      setError(e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* 1. IDENTIFICAÇÃO */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2">
          Identificação & Local
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Turma *</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: 10ª Classe A"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
            {nomeSugestao && (
              <p className="text-[11px] text-slate-500 mt-1">
                Sugestão automática: {formatTurmaName({
                  nome: nomeSugestao,
                  turno,
                  classes: classeSelecionada ? { nome: classeSelecionada.nome } : undefined,
                })}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Código da Turma *</label>
            <input
              required
              value={turmaCodigo}
              onChange={(e) => setTurmaCodigo(e.target.value)}
              placeholder="Ex: 10A, 7B"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Capacidade</label>
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={(e) => setCapacidade(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
           <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Turno *</label>
            <select
              required
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
            </select>
          </div>
        </div>
        
        <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sala / Local</label>
            <input
              value={sala}
              onChange={(e) => setSala(e.target.value)}
              placeholder="Ex: Sala 102, Laboratório"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
        </div>
      </div>

      {/* 2. CONTEXTO ACADÉMICO (VITAL PARA MATRÍCULA INTELIGENTE) */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2 flex items-center gap-2">
          Contexto Académico <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded normal-case font-normal">Recomendado</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ano Letivo *</label>
            <select
              required
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">Selecione...</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          
          <div>
             <label className="block text-xs font-bold text-slate-700 mb-1">Classe *</label>
             <select
              required
              value={classeId}
              onChange={(e) => setClasseId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">Selecione...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
             <label className="block text-xs font-bold text-slate-700 mb-1">Curso Associado {requiresCourse && <span className="text-red-600">*</span>}</label>
             <select
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">{requiresCourse ? "Selecione um curso" : "(Opcional) Ensino Geral / Todos"}</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {requiresCourse && !cursoId && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Obrigatório para turmas de 10ª classe ou acima (PUNIV/Técnico).
              </p>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
                Vincular um curso permite ao sistema calcular propinas automaticamente na matrícula.
            </p>
          </div>
        </div>
      </div>

      {/* INFO BOX */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">Por que vincular Classe e Curso?</p>
            <p>Se definir estes campos agora, quando matricular um aluno nesta turma, 
            o sistema preenche automaticamente os dados académicos e aplica a tabela de preços correta.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-center text-red-700 text-sm">
            <AlertCircle className="w-4 h-4"/> {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        {/* Use type="button" para cancelar sem submit */}
        <button
          type="button"
          onClick={onSuccess} // ou uma prop onCancel separada
          className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition"
        >
          Cancelar
        </button>
        
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-teal-600 text-white font-bold text-sm rounded-lg hover:bg-teal-700 shadow-md transition flex items-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin"/>}
          {loading ? "Criando..." : "Criar Turma"}
        </button>
      </div>
    </form>
  );
}
