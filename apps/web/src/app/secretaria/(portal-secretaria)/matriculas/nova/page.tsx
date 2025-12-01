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

// Tipo da Turma Flexível (suporta várias respostas de API)
interface Turma {
  id: string;
  nome: string;
  turno?: string;
  classe_nome?: string;
  classe?: { id: string; nome: string };
  curso_nome?: string;
  curso?: { id: string; nome: string };
  // IDs diretos se existirem
  classe_id?: string;
  curso_id?: string;
  ocupacao?: number;
  ocupacao_atual?: number;
  capacidade?: number;
  capacidade_maxima?: number;
}

// Tipo do Orçamento (Vem da API Financeira)
interface Orcamento {
  valor_matricula: number;
  valor_mensalidade: number;
  origem_regra: string;
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

  // --- ESTADOS DE SELEÇÃO ---
  const [alunoId, setAlunoId] = useState(searchParams?.get("alunoId") || "");
  const [sessionId, setSessionId] = useState("");
  const [turmaId, setTurmaId] = useState("");

  // --- ESTADO FINANCEIRO (A NOVIDADE) ---
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loadingOrcamento, setLoadingOrcamento] = useState(false);

  // --- MEMOS (Seleções Atuais) ---
  const alunoSelecionado = useMemo(() => alunosList.find((a) => a.id === alunoId), [alunoId, alunosList]);

  const turmaSelecionada = useMemo(() => turmas.find((t) => t.id === turmaId), [turmaId, turmas]);

  // --- HELPERS DE EXTRAÇÃO (Para lidar com dados aninhados) ---
  const getClasseLabel = (t?: Turma) => t?.classe?.nome || t?.classe_nome || "Classe N/D";
  const getCursoLabel = (t?: Turma) => t?.curso?.nome || t?.curso_nome || "Ensino Geral";
  const getTurnoLabel = (t?: Turma) => t?.turno || "N/D";
  const getOcupacao = (t?: Turma) => `${t?.ocupacao_atual ?? 0}/${t?.capacidade_maxima ?? 30}`;
  const isTecnico = (t?: Turma) => getCursoLabel(t).toLowerCase().includes("técnico") || getCursoLabel(t).toLowerCase().includes("saúde");

  // --- 1. CARREGAMENTO INICIAL (Alunos + Sessões) ---
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInit(true);
        const [resAlunos, resSessions] = await Promise.all([
          fetch("/api/secretaria/alunos?status=ativo"), // Só ativos podem matricular
          fetch("/api/secretaria/school-sessions"),
        ]);

        if (resAlunos.ok) {
          const json = await resAlunos.json();
          setAlunosList(json.data || json.items || []);
        }
        if (resSessions.ok) {
          const json = await resSessions.json();
          const items = json.data || json.items || [];
          setSessions(items);

          // Tenta selecionar a sessão ativa automaticamente
          const active = items.find((s: any) => s.status === "ativa");
          if (active) setSessionId(active.id);
          else if (items.length > 0) setSessionId(items[0].id);
        }
      } catch (e) {
        console.error("Erro init:", e);
      } finally {
        setLoadingInit(false);
      }
    }
    loadData();
  }, []);

  // --- 2. CARREGAR TURMAS (Quando muda o Ano) ---
  useEffect(() => {
    if (!sessionId) {
      setTurmas([]);
      setTurmaId("");
      return;
    }

    fetch(`/api/secretaria/turmas-simples?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((json) => setTurmas(json.data || []))
      .catch(console.error);
  }, [sessionId]);

  // --- 3. CARREGAR PREÇO (INTEGRAÇÃO FINANCEIRA) ---
  useEffect(() => {
    // Se não temos turma selecionada, não há preço
    if (!turmaSelecionada) {
      setOrcamento(null);
      return;
    }

    setLoadingOrcamento(true);

    // Extrair IDs necessários para a regra de preço
    // Nota: Usa os objetos aninhados que vêm da tua API atualizada de turmas
    const cursoId = turmaSelecionada.curso?.id || turmaSelecionada.curso_id;
    const classeId = turmaSelecionada.classe?.id || turmaSelecionada.classe_id;

    // Pegar Escola ID da URL (Ex: /escola/XYZ/...)
    // Em Next.js App Router podes usar useParams(), mas window location é um fallback rápido aqui
    const pathParts = window.location.pathname.split("/");
    const escolaId = pathParts[2];

    // Construir Query
    const params = new URLSearchParams({ escola_id: escolaId });
    // Assumindo ano fixo ou extraído da sessão. Para MVP usamos 2025 ou atual.
    const anoLetivo = new Date().getFullYear();
    params.append("ano", String(anoLetivo));

    if (cursoId) params.append("curso_id", cursoId);
    if (classeId) params.append("classe_id", classeId);

    // Chamar API
    fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          setOrcamento(json.data);
        } else {
          console.warn("Erro de preço:", json.error);
          setOrcamento(null); // Vai disparar o alerta visual
        }
      })
      .catch(() => setOrcamento(null))
      .finally(() => setLoadingOrcamento(false));
  }, [turmaSelecionada]); // Dispara sempre que a turma muda

  // --- 4. ENVIAR MATRÍCULA ---
  const handleSubmit = async () => {
    if (!alunoId || !sessionId || !turmaId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/secretaria/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: alunoId,
          turma_id: turmaId,
          session_id: sessionId,
          // O backend usa a mesma lógica de preço para gerar a dívida
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

  // --- RENDERIZAÇÃO ---

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
        {/* ESQUERDA: FORMULÁRIO (Scrollável) */}
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
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl appearance-none outline-none focus:ring-2 focus:ring-teal-500/20 font-medium cursor-pointer text-slate-700"
                  >
                    <option value="">Pesquisar aluno por nome ou BI...</option>
                    {alunosList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} (BI: {a.bilhete || "N/A"})
                      </option>
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
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Turma</label>
                    <select
                      value={turmaId}
                      onChange={(e) => setTurmaId(e.target.value)}
                      disabled={!sessionId}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{sessionId ? "Escolha a turma..." : "Aguardando ano..."}</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome} ({getOcupacao(t)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* DETALHES AUTOMÁTICOS (PREVIEW) */}
                {turmaSelecionada && (
                  <div className="pt-6 border-t border-slate-100 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3">Detalhes Automáticos</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div
                        className={`p-4 rounded-xl border flex flex-col items-center text-center transition-colors ${
                          isTecnico(turmaSelecionada)
                            ? "bg-purple-50 border-purple-100"
                            : "bg-indigo-50/50 border-indigo-100/50"
                        }`}
                      >
                        {isTecnico(turmaSelecionada) ? (
                          <BookOpen className="w-5 h-5 mx-auto text-purple-500 mb-2" />
                        ) : (
                          <GraduationCap className="w-5 h-5 mx-auto text-indigo-400 mb-2" />
                        )}
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Curso</p>
                        <p
                          className={`text-xs font-bold line-clamp-2 mt-0.5 ${
                            isTecnico(turmaSelecionada) ? "text-purple-900" : "text-indigo-900"
                          }`}
                        >
                          {getCursoLabel(turmaSelecionada)}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                        <Building className="w-5 h-5 mx-auto text-slate-400 mb-2" />
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Classe</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{getClasseLabel(turmaSelecionada)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                        <Clock className="w-5 h-5 mx-auto text-slate-400 mb-2" />
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
                <p className="text-sm font-medium">A consultar Tabela de Preços...</p>
              </div>
            ) : orcamento ? (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Taxa de Matrícula</span>
                  <span className="font-bold text-slate-900">{orcamento.valor_matricula.toLocaleString("pt-AO")} Kz</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Propina (Mensalidade)</span>
                  <span className="font-bold text-slate-900">{orcamento.valor_mensalidade.toLocaleString("pt-AO")} Kz</span>
                </div>

                {/* Exemplo de itens fixos (cartão/seguro) - poderiam vir da API também */}
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Cartão + Seguro</span>
                  <span className="font-medium text-slate-900">3.500 Kz</span>
                </div>

                <div className="h-px bg-dashed bg-slate-200 my-2"></div>

                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-400 uppercase">Total Inicial</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {(orcamento.valor_matricula + 3500).toLocaleString("pt-AO")} Kz
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl text-[10px] text-emerald-800 mt-4 border border-emerald-100">
                  <p>
                    ℹ️ Preço aplicado via: <strong>{orcamento.origem_regra}</strong>
                  </p>
                </div>
              </div>
            ) : !turmaId ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-300">
                <p className="text-sm text-slate-400">Selecione uma turma para calcular o valor.</p>
              </div>
            ) : (
              // ESTADO DE ERRO CRÍTICO: SEM PREÇO
              <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 flex gap-2 animate-in zoom-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <div>
                  <strong>Atenção:</strong> Não existe tabela de preços configurada para este curso/classe.
                  <br />A matrícula está bloqueada. Contacte o Financeiro.
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            // BLOQUEIA SE NÃO HOUVER ORÇAMENTO
            disabled={submitting || !alunoId || !turmaId || !orcamento}
            className={`
              w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1
              ${submitting || !alunoId || !turmaId || !orcamento
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"}
            `}
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
            <span className="text-lg font-black text-emerald-600">
              {orcamento ? (orcamento.valor_matricula + 3500).toLocaleString("pt-AO") : "—"} Kz
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
