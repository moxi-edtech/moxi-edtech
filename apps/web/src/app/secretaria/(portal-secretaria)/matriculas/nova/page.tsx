"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  User,
  Building,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Search,
  X,
  GraduationCap,
  Clock,
  AlertCircle,
  BookOpen,
} from "lucide-react";

// --- TIPOS ---
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

interface Ref {
  id: string;
  nome: string;
}

interface Curso {
  id: string;
  nome: string;
  tipo: string;
  classes: Ref[];
}

// Tipo da Turma Flexível
interface Turma {
  id: string;
  nome: string;
  turno?: string;
  classe_nome?: string;
  classe?: { id: string; nome: string };
  curso_nome?: string;
  curso?: { id: string; nome: string };
  curso_global_hash?: string;
  curso_tipo?: string;
  classe_id?: string;
  curso_id?: string;
  ocupacao?: number;
  ocupacao_atual?: number;
  capacidade?: number;
  capacidade_maxima?: number;
}

// Tipo do Orçamento
interface Orcamento {
  valor_matricula: number | null;
  valor_mensalidade: number;
  origem_regra: string;
  dia_vencimento?: number | null;
}

export default function NovaMatriculaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- ESTADOS DE DADOS ---
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [alunosList, setAlunosList] = useState<Aluno[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);

  // --- ESTADOS DE SELEÇÃO ---
  const [alunoId, setAlunoId] = useState(searchParams?.get("alunoId") || "");
  const [sessionId, setSessionId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [destinoTipo, setDestinoTipo] = useState<"classe" | "curso">("classe");
  const [cursoIdSelecionado, setCursoIdSelecionado] = useState("");
  const [classeIdSelecionado, setClasseIdSelecionado] = useState("");
  const [historicoExterno, setHistoricoExterno] = useState<"" | "10" | "12">("");

  // --- ESTADO FINANCEIRO ---
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loadingOrcamento, setLoadingOrcamento] = useState(false);

  const sessionSelecionada = useMemo(() => sessions.find((s) => s.id === sessionId), [sessions, sessionId]);

  // --- MEMOS (Seleções Atuais) ---
  const alunoSelecionado = useMemo(() => alunosList.find((a) => a.id === alunoId), [alunoId, alunosList]);
  const turmaSelecionada = useMemo(() => turmas.find((t) => t.id === turmaId), [turmaId, turmas]);

  // --- HELPERS DE EXTRAÇÃO ---
  const getClasseLabel = (t?: Turma) => t?.classe?.nome || t?.classe_nome || "Classe N/D";
  const getCursoLabel = (t?: Turma) => t?.curso?.nome || t?.curso_nome || "Ensino Geral";
  const getTurnoLabel = (t?: Turma) => t?.turno || "N/D";
  const getOcupacao = (t?: Turma) => `${t?.ocupacao_atual ?? 0}/${t?.capacidade_maxima ?? 30}`;
  
  const isCursoTecnicoOuPuniv = (curso?: Curso) => {
    const tipo = curso?.tipo?.toLowerCase();
    if (tipo === "tecnico" || tipo === "puniv") return true;

    const nome = curso?.nome?.toLowerCase() || "";
    if (nome.includes("técnico") || nome.includes("tecnico")) return true;
    if (nome.includes("puniv")) return true;
    if (nome.includes("ii ciclo") || nome.includes("iiº ciclo")) return true;
    return false;
  };

  const getCursoId = (t?: Turma) => t?.curso?.id || t?.curso_id || t?.curso_global_hash || t?.curso_nome || getCursoLabel(t);
  const getClasseId = (t?: Turma) => t?.classe?.id || t?.classe_id || t?.classe_nome || getClasseLabel(t);
  const resolveCursoId = (t?: Turma) => t?.curso?.id || t?.curso_id || cursoIdSelecionado || undefined;
  const resolveClasseId = (t?: Turma) => t?.classe?.id || t?.classe_id || classeIdSelecionado || undefined;

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const texto = String(valor);
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const anoLetivoAtivo = useMemo(() => {
    // Tenta extrair o ano de várias fontes possíveis
    const candidatos = [
      (turmaSelecionada as any)?.ano_letivo,
      (turmaSelecionada as any)?.ano,
      (sessionSelecionada as any)?.ano_letivo,
      (sessionSelecionada as any)?.nome,
    ];

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato);
      if (ano) return ano;
    }
    return new Date().getFullYear();
  }, [turmaSelecionada, sessionSelecionada]);

  // --- INTELIGÊNCIA DE LISTAS ---

  const cursosDisponiveis = useMemo(() => {
    return cursos.filter(isCursoTecnicoOuPuniv);
  }, [cursos]);

  // [FIX] Lógica inteligente para Classes: Remove duplicatas e ordena naturalmente
  const classesDisponiveis = useMemo(() => {
    // 1. Se filtro por curso está ativo, retorna só as classes dele
    if (destinoTipo === 'curso' && cursoIdSelecionado) {
      const curso = cursos.find(c => c.id === cursoIdSelecionado);
      return curso?.classes || [];
    }
    
    // 2. Senão, agrupa todas as classes de todos os cursos removendo duplicatas
    const mapClasses = new Map<string, Ref>();
    
    cursos.forEach(c => {
        c.classes.forEach(cls => {
            // Usa o ID como chave única. Se não tiver ID, usa o nome.
            const key = cls.id || cls.nome;
            if (key && !mapClasses.has(key)) {
                mapClasses.set(key, cls);
            }
        });
    });

    const unicas = Array.from(mapClasses.values());

    // 3. Ordenação Natural (ex: 7ª, 8ª, 9ª, 10ª...)
    return unicas.sort((a, b) => {
        return a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [cursos, destinoTipo, cursoIdSelecionado]);

  const classesFiltradas = useMemo(() => {
    if (historicoExterno === "10") return classesDisponiveis.filter((c) => c.nome.includes("10"));
    if (historicoExterno === "12") return classesDisponiveis.filter((c) => c.nome.includes("12"));
    return classesDisponiveis;
  }, [classesDisponiveis, historicoExterno]);

  const turmasFiltradas = useMemo(() => {
    return turmas.filter((t) => {
      // Filtro 1: Modo Curso Técnico
      if (destinoTipo === "curso") {
        if (!cursoIdSelecionado) return false; // Espera selecionar curso
        
        // Verifica se a turma pertence ao curso selecionado (comparação flexível ID ou Nome)
        const turmaCursoId = getCursoId(t);
        const turmaCursoNome = getCursoLabel(t).toLowerCase();
        
        // Tenta achar o curso selecionado para comparar nome se ID falhar
        const cursoSelObj = cursos.find(c => c.id === cursoIdSelecionado);
        
        const matchId = turmaCursoId === cursoIdSelecionado;
        const matchNome = cursoSelObj && turmaCursoNome.includes(cursoSelObj.nome.toLowerCase());
        
        return matchId || matchNome;
      }

      // Filtro 2: Modo Classe (Ensino Geral ou Pré-seleção)
      if (historicoExterno === "10") return getClasseLabel(t).includes("10");
      if (historicoExterno === "12") return getClasseLabel(t).includes("12");
      
      if (classeIdSelecionado) {
         // Compara ID se possível, senão nome
         const tClasseId = getClasseId(t);
         const tClasseNome = getClasseLabel(t);
         
         // Busca objeto da classe selecionada para comparar nome
         const clsSelObj = classesDisponiveis.find(c => c.id === classeIdSelecionado);
         
         return tClasseId === classeIdSelecionado || (clsSelObj && tClasseNome === clsSelObj.nome);
      }
      
      return true;
    });
  }, [turmas, destinoTipo, cursoIdSelecionado, classeIdSelecionado, historicoExterno, cursos, classesDisponiveis]);

  // --- 1. CARREGAMENTO INICIAL ---
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInit(true);

        const paramsSessions = new URLSearchParams();
        if (alunoId) paramsSessions.set("aluno_id", alunoId);

        const [resSessions, resCursos] = await Promise.all([
          fetch(`/api/secretaria/school-sessions${paramsSessions.toString() ? `?${paramsSessions.toString()}` : ""}`),
          fetch("/api/secretaria/cursos-com-classes"),
        ]);

        if (resSessions.ok) {
          const json = await resSessions.json();
          const items = json.data || json.items || [];
          setSessions(items);
          const active = items.find((s: any) => s.status === "ativa");
          const nextSessionId = (active?.id || items[0]?.id) as string | undefined;
          if (nextSessionId) setSessionId((prev) => prev || nextSessionId);
        }

        if (resCursos.ok) {
          const json = await resCursos.json();
          setCursos(json.items || []);
        }

      } catch (e) {
        console.error("Erro init:", e);
      } finally {
        setLoadingInit(false);
      }
    }
    loadData();
  }, [alunoId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const loadAlunos = async () => {
      try {
        setLoadingAlunos(true);
        setAlunosList([]);
        const resAlunos = await fetch(`/api/secretaria/alunos?status=ativo&session_id=${sessionId}`);
        if (resAlunos.ok) {
          const json = await resAlunos.json();
          if (!cancelled) setAlunosList(json.data || json.items || []);
        }
      } catch (e) {
        if (!cancelled) console.error("Erro ao carregar alunos:", e);
      } finally {
        if (!cancelled) setLoadingAlunos(false);
      }
    };
    loadAlunos();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (alunoId && !alunosList.some((a) => a.id === alunoId)) {
      setAlunoId("");
    }
  }, [alunosList, alunoId]);

  // --- 2. CARREGAR TURMAS ---
  useEffect(() => {
    if (!sessionId) {
      setTurmas([]);
      setTurmaId("");
      return;
    }

    const params = new URLSearchParams({ session_id: sessionId });
    if (alunoId) params.set("aluno_id", alunoId);

    fetch(`/api/secretaria/turmas-simples?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => setTurmas(json.data || json.items || []))
      .catch(console.error);
  }, [sessionId, alunoId]);

  // Reset inteligente ao mudar filtros
  useEffect(() => {
    setTurmaId("");
  }, [destinoTipo, cursoIdSelecionado, classeIdSelecionado, historicoExterno]);

  // Auto-seleção de classe baseada em histórico
  useEffect(() => {
    if (!historicoExterno) return;
    const primeiraClasseCompativel = classesFiltradas[0];
    if (!primeiraClasseCompativel) return;
    const classeAindaValida = classesFiltradas.some((c) => c.id === classeIdSelecionado);
    if (!classeAindaValida) setClasseIdSelecionado(primeiraClasseCompativel.id);
  }, [historicoExterno, classesFiltradas, classeIdSelecionado]);

  // --- 3. CARREGAR PREÇO ---
  useEffect(() => {
    if (!turmaSelecionada) {
      setOrcamento(null);
      return;
    }

    setLoadingOrcamento(true);
    const cursoId = resolveCursoId(turmaSelecionada);
    const classeId = resolveClasseId(turmaSelecionada);

    const params = new URLSearchParams();
    params.append("ano", String(anoLetivoAtivo));
    if (cursoId) params.append("curso_id", cursoId);
    if (classeId) params.append("classe_id", classeId);
    if (sessionId) params.append("session_id", sessionId);

    fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setOrcamento(json.data);
        else setOrcamento(null);
      })
      .catch(() => setOrcamento(null))
      .finally(() => setLoadingOrcamento(false));
  }, [turmaSelecionada, anoLetivoAtivo, sessionId]);

  // --- 4. ENVIAR MATRÍCULA ---
  const handleSubmit = async () => {
    if (!alunoId || !sessionId || !turmaId) return;
    setSubmitting(true);
    try {
      const cursoResolvedId = resolveCursoId(turmaSelecionada);
      const classeResolvedId = resolveClasseId(turmaSelecionada);

      const res = await fetch("/api/secretaria/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: alunoId,
          turma_id: turmaId,
          session_id: sessionId,
          curso_id: cursoResolvedId,
          classe_id: classeResolvedId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar");
      alert(`Sucesso! Nº Processo: ${json.data?.numero_matricula}`);
      router.back();
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const valorMatriculaDisplay = orcamento?.valor_matricula != null ? orcamento.valor_matricula.toLocaleString("pt-AO") : "—";
  const totalInicial = (orcamento?.valor_matricula ?? 0) + 3500;

  if (loadingInit) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* HEADER FIXO */}
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Nova Matrícula</h1>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-teal-600 font-bold flex items-center gap-1">
            <User className="w-3 h-3" /> Seleção
          </span>
          <span className="w-4 h-px bg-slate-300"></span>
          <span className="text-teal-600 font-bold flex items-center gap-1">
            <Building className="w-3 h-3" /> Alocação
          </span>
          <span className="w-4 h-px bg-slate-300"></span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Confirmação
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* ESQUERDA: FORMULÁRIO */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-32 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* 1. SELEÇÃO DE ALUNO */}
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
                    disabled={loadingAlunos}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl appearance-none outline-none focus:ring-2 focus:ring-teal-500/20 font-medium cursor-pointer text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{loadingAlunos ? "Carregando alunos..." : "Pesquisar aluno por nome ou BI..."}</option>
                    {!loadingAlunos &&
                      alunosList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome} (BI: {a.bilhete || "N/A"})
                        </option>
                      ))}
                  </select>
                </div>
                {!loadingAlunos && alunosList.length === 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Nenhum aluno ativo encontrado para matricular neste ano.
                  </p>
                )}
                {alunoSelecionado && (
                  <div className="mt-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-black text-2xl border-2 border-white shadow-sm">
                      {alunoSelecionado.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{alunoSelecionado.nome}</p>
                      <p className="text-sm text-slate-500">BI: {alunoSelecionado.bilhete || "Não informado"}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. SELEÇÃO DE TURMA */}
            <section className={`space-y-4 transition-all duration-500 ${!alunoId ? "opacity-50 grayscale pointer-events-none" : ""}`}>
              <div className="flex items-center gap-3 text-slate-800">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">2</div>
                <h2 className="text-lg font-bold">Para onde vai?</h2>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ano Letivo</label>
                    <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer">
                      <option value="">Selecione...</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tipo de matrícula</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "classe", label: "Geral / Classe" },
                        { key: "curso", label: "Técnico / Curso" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setDestinoTipo(opt.key as "classe" | "curso");
                            setCursoIdSelecionado("");
                            setClasseIdSelecionado("");
                            setHistoricoExterno("");
                          }}
                          className={`px-4 py-3 rounded-xl border font-bold text-xs transition-all ${
                            destinoTipo === opt.key
                              ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {destinoTipo === "curso" ? (
                  <div className="grid md:grid-cols-2 gap-6 animate-in slide-in-from-left-2 duration-300">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Curso</label>
                      <select
                        value={cursoIdSelecionado}
                        onChange={(e) => setCursoIdSelecionado(e.target.value)}
                        disabled={!sessionId}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="">{sessionId ? "Selecione o curso..." : "Aguardando ano..."}</option>
                        {cursosDisponiveis.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Turma</label>
                      <select
                        value={turmaId}
                        onChange={(e) => setTurmaId(e.target.value)}
                        disabled={!sessionId || !cursoIdSelecionado}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="">
                            {turmasFiltradas.length === 0 && cursoIdSelecionado 
                             ? "Nenhuma turma neste curso" 
                             : "Escolha a turma..."}
                        </option>
                        {turmasFiltradas.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome} ({getOcupacao(t)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Histórico</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[{ value: "", label: "Normal" }, { value: "10", label: "10ª Conc." }, { value: "12", label: "12ª Conc." }].map((opt) => (
                            <button
                              key={opt.value || "nenhum"}
                              type="button"
                              onClick={() => setHistoricoExterno(opt.value as "" | "10" | "12")}
                              className={`px-2 py-3 rounded-xl border font-bold text-xs transition-all ${
                                historicoExterno === opt.value
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Classe</label>
                        <select
                          value={classeIdSelecionado}
                          onChange={(e) => setClasseIdSelecionado(e.target.value)}
                          disabled={!sessionId || classesFiltradas.length === 0}
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="">{sessionId ? "Selecione a classe..." : "Aguardando ano..."}</option>
                          {classesFiltradas.map((c) => (
                            // [FIX] AQUI O ERRO FOI CORRIGIDO: Chaves garantidamente únicas
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Turma</label>
                      <select
                        value={turmaId}
                        onChange={(e) => setTurmaId(e.target.value)}
                        disabled={!sessionId || (!classeIdSelecionado && !historicoExterno)}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer disabled:opacity-50"
                      >
                         <option value="">
                            {turmasFiltradas.length === 0 && classeIdSelecionado
                             ? "Nenhuma turma nesta classe" 
                             : "Selecione a classe primeiro..."}
                        </option>
                        {turmasFiltradas.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome} ({getOcupacao(t)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* DETALHES AUTOMÁTICOS (PREVIEW) */}
                {turmaSelecionada && (
                  <div className="pt-6 border-t border-slate-100 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-colors ${
                          isCursoTecnicoOuPuniv(cursos.find(c => c.id === turmaSelecionada.curso_id))
                            ? "bg-purple-50 border-purple-100"
                            : "bg-indigo-50/50 border-indigo-100/50"
                        }`}>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Curso</p>
                        <p className="text-xs font-bold line-clamp-2 mt-0.5 text-slate-900">
                          {getCursoLabel(turmaSelecionada)}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Classe</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{getClasseLabel(turmaSelecionada)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
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

        {/* DIREITA: RESUMO FINANCEIRO DINÂMICO */}
        <aside className="hidden lg:flex flex-col w-[380px] bg-white border-l border-slate-200 p-8 z-10 shadow-[-10px_0_40px_-20px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Resumo Financeiro</h3>
          </div>

          <div className="flex-1 space-y-6">
            {loadingOrcamento ? (
              <div className="py-12 text-center text-slate-400 animate-pulse flex flex-col items-center">
                <Loader2 className="w-8 h-8 mb-3 animate-spin text-emerald-500" />
                <p className="text-sm font-medium">Calculando preço...</p>
              </div>
            ) : orcamento ? (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Taxa de Matrícula</span>
                  <span className="font-bold text-slate-900">{valorMatriculaDisplay} Kz</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Propina (Mensalidade)</span>
                  <span className="font-bold text-slate-900">{orcamento.valor_mensalidade.toLocaleString("pt-AO")} Kz</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Cartão + Seguro</span>
                  <span className="font-medium text-slate-900">3.500 Kz</span>
                </div>
                <div className="h-px bg-dashed bg-slate-200 my-2"></div>
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-400 uppercase">Total Inicial</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {totalInicial.toLocaleString("pt-AO")} Kz
                  </span>
                </div>
              </div>
            ) : !turmaId ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-300">
                <p className="text-sm text-slate-400">Selecione uma turma para ver o preço.</p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 flex gap-2 animate-in zoom-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <div>
                  <strong>Atenção:</strong> Sem preço configurado. Contacte o Financeiro.
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !alunoId || !turmaId || !orcamento}
            className={`
              w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1
              ${submitting || !alunoId || !turmaId || !orcamento
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"}
            `}
          >
            {submitting ? (
              <> <Loader2 className="w-5 h-5 animate-spin" /> Processando... </>
            ) : (
              <> Confirmar Matrícula <ArrowRight className="w-5 h-5" /> </>
            )}
          </button>
        </aside>

        {/* MOBILE FOOTER */}
        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-50 flex flex-col gap-3 shadow-top">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total</span>
            <span className="text-lg font-black text-emerald-600">
              {orcamento ? totalInicial.toLocaleString("pt-AO") : "—"} Kz
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!orcamento || submitting}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-slate-900 disabled:bg-slate-300 shadow-lg"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
