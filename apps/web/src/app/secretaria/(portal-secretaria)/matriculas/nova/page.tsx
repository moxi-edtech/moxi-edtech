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
  AlertCircle,
} from "lucide-react";

// --- TIPOS ---
interface Aluno {
  id: string;
  nome: string;
  bi_numero?: string | null;
  bilhete?: string | null;
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

interface Orcamento {
  valor_matricula: number | null;
  valor_mensalidade: number;
  origem_regra: string;
  dia_vencimento?: number | null;
}

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const inputBase =
  "w-full px-4 py-3 bg-white text-sm text-slate-900 rounded-xl ring-1 ring-slate-200 outline-none";
const inputFocus =
  "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold focus:outline-none";

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

  const sessionSelecionada = useMemo(
    () => sessions.find((s) => s.id === sessionId),
    [sessions, sessionId]
  );

  const alunoSelecionado = useMemo(
    () => alunosList.find((a) => a.id === alunoId),
    [alunoId, alunosList]
  );
  const turmaSelecionada = useMemo(
    () => turmas.find((t) => t.id === turmaId),
    [turmaId, turmas]
  );

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

  const getCursoId = (t?: Turma) =>
    t?.curso?.id || t?.curso_id || t?.curso_global_hash || t?.curso_nome || getCursoLabel(t);
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
  const cursosDisponiveis = useMemo(() => cursos.filter(isCursoTecnicoOuPuniv), [cursos]);

  const classesDisponiveis = useMemo(() => {
    if (destinoTipo === "curso" && cursoIdSelecionado) {
      const curso = cursos.find((c) => c.id === cursoIdSelecionado);
      return curso?.classes || [];
    }

    const mapClasses = new Map<string, Ref>();
    cursos.forEach((c) => {
      c.classes.forEach((cls) => {
        const key = cls.id || cls.nome;
        if (key && !mapClasses.has(key)) mapClasses.set(key, cls);
      });
    });

    const unicas = Array.from(mapClasses.values());
    return unicas.sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: "base" }));
  }, [cursos, destinoTipo, cursoIdSelecionado]);

  const classesFiltradas = useMemo(() => {
    if (historicoExterno === "10") return classesDisponiveis.filter((c) => c.nome.includes("10"));
    if (historicoExterno === "12") return classesDisponiveis.filter((c) => c.nome.includes("12"));
    return classesDisponiveis;
  }, [classesDisponiveis, historicoExterno]);

  const turmasFiltradas = useMemo(() => {
    return turmas.filter((t) => {
      if (destinoTipo === "curso") {
        if (!cursoIdSelecionado) return false;

        const turmaCursoId = getCursoId(t);
        const turmaCursoNome = getCursoLabel(t).toLowerCase();
        const cursoSelObj = cursos.find((c) => c.id === cursoIdSelecionado);

        const matchId = turmaCursoId === cursoIdSelecionado;
        const matchNome = cursoSelObj && turmaCursoNome.includes(cursoSelObj.nome.toLowerCase());
        return matchId || matchNome;
      }

      if (historicoExterno === "10") return getClasseLabel(t).includes("10");
      if (historicoExterno === "12") return getClasseLabel(t).includes("12");

      if (classeIdSelecionado) {
        const tClasseId = getClasseId(t);
        const tClasseNome = getClasseLabel(t);
        const clsSelObj = classesDisponiveis.find((c) => c.id === classeIdSelecionado);
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

  // --- 1b. CARREGA ALUNOS (ativos + pendentes) ---
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const loadAlunos = async () => {
      try {
        setLoadingAlunos(true);

        const urls = [
          `/api/secretaria/alunos?status=ativo&session_id=${sessionId}`,
          `/api/secretaria/alunos?status=pendente&session_id=${sessionId}`,
        ];

        const results = await Promise.all(urls.map((url) => fetch(url).then((res) => res.json())));
        if (cancelled) return;

        const combinedAlunos = results.flatMap((json) => json.items || json.data || []);
        const uniqueAlunos = Array.from(new Map(combinedAlunos.map((a: any) => [a.id, a])).values());

        setAlunosList(uniqueAlunos);
      } catch (e) {
        if (!cancelled) console.error("Erro ao carregar alunos:", e);
      } finally {
        if (!cancelled) setLoadingAlunos(false);
      }
    };

    loadAlunos();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
          ano_letivo: anoLetivoAtivo,
          session_id: sessionId,
          curso_id: cursoResolvedId,
          classe_id: classeResolvedId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar");

      const numeroMatricula =
        json.data?.numero_matricula ?? json.data?.matricula?.numero_matricula ?? json.data?.matricula?.numero;

      alert(`Sucesso! Nº Matrícula: ${numeroMatricula ?? "—"}`);
      router.back();
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const valorMatriculaDisplay =
    orcamento?.valor_matricula != null ? orcamento.valor_matricula.toLocaleString("pt-AO") : "—";
  const totalInicial = (orcamento?.valor_matricula ?? 0) + 3500;

  if (loadingInit) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-klasse-gold" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sora">
      {/* HEADER FIXO */}
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Nova Matrícula</h1>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-klasse-gold font-bold flex items-center gap-1">
            <User className="w-3 h-3" /> Seleção
          </span>
          <span className="w-4 h-px bg-slate-300" />
          <span className="text-klasse-gold font-bold flex items-center gap-1">
            <Building className="w-3 h-3" /> Alocação
          </span>
          <span className="w-4 h-px bg-slate-300" />
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Confirmação
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* ESQUERDA */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-32">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* 1. SELEÇÃO DE ALUNO */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-slate-900">
                <div className="w-8 h-8 rounded-full bg-klasse-green/10 text-klasse-green flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2 className="text-lg font-bold">Quem vamos matricular?</h2>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-klasse-gold/40 transition-colors">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <select
                    value={alunoId}
                    onChange={(e) => setAlunoId(e.target.value)}
                    disabled={loadingAlunos}
                    className={cn(
                      "w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl appearance-none cursor-pointer",
                      "ring-1 ring-slate-200 text-slate-800 font-medium outline-none",
                      "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <option value="">
                      {loadingAlunos ? "Carregando alunos..." : "Pesquisar aluno por nome ou BI..."}
                    </option>
                    {!loadingAlunos &&
                      alunosList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome} (BI: {a.bi_numero || a.bilhete || "N/A"})
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
                    <div className="w-16 h-16 rounded-full bg-klasse-green/10 text-klasse-green flex items-center justify-center font-black text-2xl ring-1 ring-slate-200 shadow-sm">
                      {alunoSelecionado.nome.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-lg truncate">{alunoSelecionado.nome}</p>
                      <p className="text-sm text-slate-500 truncate">
                        BI: {alunoSelecionado.bi_numero || alunoSelecionado.bilhete || "Não informado"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. SELEÇÃO DE TURMA */}
            <section
              className={cn(
                "space-y-4 transition-all duration-500",
                !alunoId && "opacity-50 grayscale pointer-events-none"
              )}
            >
              <div className="flex items-center gap-3 text-slate-900">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h2 className="text-lg font-bold">Para onde vai?</h2>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ano Letivo</label>
                    <select
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className={cn(inputBase, inputFocus, "bg-slate-50")}
                    >
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
                          className={cn(
                            "px-4 py-3 rounded-xl font-bold text-xs transition-all ring-1",
                            destinoTipo === opt.key
                              ? "bg-slate-900 text-white ring-slate-900 shadow-sm"
                              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                          )}
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
                        className={cn(inputBase, inputFocus, "bg-slate-50", "disabled:opacity-50")}
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
                        className={cn(inputBase, inputFocus, "bg-slate-50", "disabled:opacity-50")}
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
                          {[
                            { value: "", label: "Normal" },
                            { value: "10", label: "10ª Conc." },
                            { value: "12", label: "12ª Conc." },
                          ].map((opt) => (
                            <button
                              key={opt.value || "nenhum"}
                              type="button"
                              onClick={() => setHistoricoExterno(opt.value as "" | "10" | "12")}
                              className={cn(
                                "px-2 py-3 rounded-xl font-bold text-xs transition-all ring-1",
                                historicoExterno === opt.value
                                  ? "bg-klasse-green/10 text-klasse-green ring-klasse-green/20"
                                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                              )}
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
                          className={cn(inputBase, inputFocus, "bg-slate-50", "disabled:opacity-50")}
                        >
                          <option value="">{sessionId ? "Selecione a classe..." : "Aguardando ano..."}</option>
                          {classesFiltradas.map((c) => (
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
                        className={cn(inputBase, inputFocus, "bg-slate-50", "disabled:opacity-50")}
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

                {/* PREVIEW */}
                {turmaSelecionada && (
                  <div className="pt-6 border-t border-slate-100 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-4">
                      <div
                        className={cn(
                          "p-4 rounded-xl ring-1 flex flex-col items-center text-center transition-colors",
                          isCursoTecnicoOuPuniv(cursos.find((c) => c.id === turmaSelecionada.curso_id))
                            ? "bg-slate-50 ring-slate-200"
                            : "bg-slate-50 ring-slate-200"
                        )}
                      >
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Curso</p>
                        <p className="text-xs font-bold line-clamp-2 mt-0.5 text-slate-900">
                          {getCursoLabel(turmaSelecionada)}
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl ring-1 ring-slate-200 flex flex-col items-center text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Classe</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{getClasseLabel(turmaSelecionada)}</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl ring-1 ring-slate-200 flex flex-col items-center text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Turno</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5 capitalize">
                          {getTurnoLabel(turmaSelecionada)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>

        {/* DIREITA: RESUMO FINANCEIRO */}
        <aside className="hidden lg:flex flex-col w-[380px] bg-white border-l border-slate-200 p-8 z-10 shadow-[-10px_0_40px_-20px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-klasse-green/10 rounded-xl text-klasse-green ring-1 ring-klasse-green/20">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Resumo Financeiro</h3>
          </div>

          <div className="flex-1 space-y-6">
            {loadingOrcamento ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                <Loader2 className="w-8 h-8 mb-3 animate-spin text-klasse-gold" />
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

                <div className="h-px bg-slate-200 my-2" />

                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-400 uppercase">Total Inicial</span>
                  <span className="text-2xl font-black text-klasse-green">
                    {totalInicial.toLocaleString("pt-AO")} Kz
                  </span>
                </div>
              </div>
            ) : !turmaId ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center ring-1 ring-slate-200 border-dashed">
                <p className="text-sm text-slate-500">Selecione uma turma para ver o preço.</p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl ring-1 ring-amber-200 flex gap-2">
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
            className={cn(
              "w-full py-4 rounded-xl font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all",
              "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20",
              submitting || !alunoId || !turmaId || !orcamento
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-klasse-gold hover:brightness-95 active:scale-[0.99]"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processando...
              </>
            ) : (
              <>
                Confirmar Matrícula <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </aside>

        {/* MOBILE FOOTER */}
        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-50 flex flex-col gap-3 shadow-top">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total</span>
            <span className="text-lg font-black text-klasse-green">
              {orcamento ? totalInicial.toLocaleString("pt-AO") : "—"} Kz
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!orcamento || submitting}
            className={cn(
              "w-full py-3.5 rounded-xl font-bold text-white shadow-sm",
              "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20",
              !orcamento || submitting ? "bg-slate-300" : "bg-klasse-gold hover:brightness-95"
            )}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}