"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Users,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  TrendingDown,
  RefreshCw,
  Calendar,
  Sliders,
  AlertCircle
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Progress } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TurmaItem {
  id: string;
  turma_nome: string;
  classe_nome?: string;
  curso_nome?: string;
  turno?: string;
}

interface ProntidaoRow {
  turma_disciplina_id: string;
  disciplina_nome: string;
  professor_nome: string;
  tipo: string;
  total_alunos: number;
  notas_lancadas: number;
  pendentes: number;
  percentual_lancado: number;
}

interface PendenteRow {
  aluno_id: string;
  aluno_nome: string;
  numero_processo: string;
  disciplina_nome: string;
  tipo_avaliacao: string;
  professor_nome: string;
  professor_telefone: string;
}

interface AlunoRiscoRow {
  aluno_id: string;
  aluno_nome: string;
  numero_processo: string;
  disciplina_nome: string;
  nota_final: number;
}

interface CockpitData {
  prontidao: ProntidaoRow[];
  pendentes: PendenteRow[];
  alunosRisco: AlunoRiscoRow[];
}

export default function CockpitPedagogicoPage() {
  const { escolaId, escolaSlug, isLoading: loadingEscola } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  // Filter states
  const [selectedTrimestre, setSelectedTrimestre] = useState<number>(1);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");

  // Options & loading state
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [cockpitData, setCockpitData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Copied reminder UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch classes (turmas) on mount or school change
  useEffect(() => {
    if (!escolaParam) return;

    const loadTurmas = async () => {
      setLoadingTurmas(true);
      try {
        const res = await fetch(`/api/secretaria/turmas-simples`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          const items = json.items || json.data || [];
          setTurmas(items);
          if (items.length > 0 && !selectedTurmaId) {
            setSelectedTurmaId(items[0].id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar turmas:", err);
      } finally {
        setLoadingTurmas(false);
      }
    };

    void loadTurmas();
  }, [escolaParam]);

  // Fetch cockpit data when selection changes
  const fetchCockpitData = async (turmaId: string, trimestre: number) => {
    if (!turmaId) return;
    setLoadingData(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        turmaId,
        trimestre: String(trimestre),
      });
      const res = await fetch(`/api/secretaria/fechamento-academico/cockpit?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar os dados do cockpit.");
      }
      setCockpitData(json.data);
    } catch (err) {
      console.error("Erro ao carregar dados do cockpit:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido ao buscar dados.");
      setCockpitData(null);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedTurmaId) {
      void fetchCockpitData(selectedTurmaId, selectedTrimestre);
    } else {
      setCockpitData(null);
    }
  }, [selectedTurmaId, selectedTrimestre]);

  // Group progress data by discipline
  const prontidaoAgrupada = useMemo(() => {
    if (!cockpitData?.prontidao) return {};
    
    const groups: Record<
      string,
      {
        disciplina_nome: string;
        professor_nome: string;
        avaliacoes: Record<
          string,
          {
            total_alunos: number;
            notas_lancadas: number;
            pendentes: number;
            percentual_lancado: number;
          }
        >;
      }
    > = {};

    cockpitData.prontidao.forEach((row) => {
      if (!groups[row.disciplina_nome]) {
        groups[row.disciplina_nome] = {
          disciplina_nome: row.disciplina_nome,
          professor_nome: row.professor_nome,
          avaliacoes: {},
        };
      }
      groups[row.disciplina_nome].avaliacoes[row.tipo] = {
        total_alunos: row.total_alunos,
        notas_lancadas: row.notas_lancadas,
        pendentes: row.pendentes,
        percentual_lancado: Number(row.percentual_lancado),
      };
    });

    return groups;
  }, [cockpitData]);

  // Overall metrics
  const summaryMetrics = useMemo(() => {
    if (!cockpitData) return { totalDisciplines: 0, overallProgress: 0, totalPendentes: 0, totalRisco: 0 };
    
    const totalPendentes = cockpitData.pendentes.length;
    const totalRisco = new Set(cockpitData.alunosRisco.map(r => r.aluno_id)).size;
    const totalDisciplines = Object.keys(prontidaoAgrupada).length;

    let sumPercent = 0;
    let countPercent = 0;

    cockpitData.prontidao.forEach((row) => {
      sumPercent += Number(row.percentual_lancado);
      countPercent++;
    });

    const overallProgress = countPercent > 0 ? Math.round(sumPercent / countPercent) : 0;

    return {
      totalDisciplines,
      overallProgress,
      totalPendentes,
      totalRisco,
    };
  }, [cockpitData, prontidaoAgrupada]);

  // Selected class detail
  const currentTurmaLabel = useMemo(() => {
    const found = turmas.find((t) => t.id === selectedTurmaId);
    if (!found) return "";
    return `${found.turma_nome} (${found.classe_nome || ""} - ${found.curso_nome || ""})`;
  }, [turmas, selectedTurmaId]);

  // Copy Reminder Message
  const handleCopyReminder = (p: PendenteRow, uniqueId: string) => {
    const msg = `Olá Professor(a) ${p.professor_nome}, identificamos que a nota de ${p.tipo_avaliacao} na disciplina de ${p.disciplina_nome} para o aluno ${p.aluno_nome} (Nº Processo: ${p.numero_processo}) no ${selectedTrimestre}º Trimestre ainda não foi lançada. Por favor, regularize o lançamento no sistema KLASSE o quanto antes. Obrigado!`;
    
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(uniqueId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Falha ao copiar texto:", err);
    });
  };

  // WhatsApp Reminder Link Builder
  const getWhatsAppLink = (p: PendenteRow) => {
    if (!p.professor_telefone) return null;
    const cleanPhone = p.professor_telefone.replace(/\D/g, "");
    if (!cleanPhone) return null;
    
    const phoneWithCode = cleanPhone.startsWith("244") ? cleanPhone : `244${cleanPhone}`;
    const msg = `Olá Professor(a) ${p.professor_nome}, identificamos que a nota de ${p.tipo_avaliacao} na disciplina de ${p.disciplina_nome} para o aluno ${p.aluno_nome} (Nº Processo: ${p.numero_processo}) no ${selectedTrimestre}º Trimestre ainda não foi lançada. Por favor, regularize o lançamento no sistema KLASSE o quanto antes. Obrigado!`;
    
    return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <main className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back button and Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={buildPortalHref(escolaParam, "/secretaria/fechamento-academico")}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Fechamento Académico
        </Link>
        <DashboardHeader
          title="Cockpit de Prontidão Pedagógica & Conselho"
          description="Acompanhe o lançamento de notas, detete pendências e simule o risco de reprovação para o Conselho de Turma."
          breadcrumbs={[
            { label: "Início", href: buildPortalHref(escolaParam, "/") },
            { label: "Secretaria", href: buildPortalHref(escolaParam, "/secretaria") },
            { label: "Fechamento", href: buildPortalHref(escolaParam, "/secretaria/fechamento-academico") },
            { label: "Cockpit" },
          ]}
        />
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <Sliders className="w-4 h-4 text-[#1F6B3B]" />
            Filtros do Painel:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Turma (Classe & Curso)</label>
              <select
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F6B3B]"
                value={selectedTurmaId}
                onChange={(e) => setSelectedTurmaId(e.target.value)}
                disabled={loadingTurmas}
              >
                {loadingTurmas ? (
                  <option>A carregar turmas...</option>
                ) : turmas.length === 0 ? (
                  <option value="">Nenhuma turma ativa encontrada</option>
                ) : (
                  turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.turma_nome} {t.classe_nome ? `· ${t.classe_nome}` : ""} {t.turno ? `(${t.turno})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Trimestre Lectivo</label>
              <select
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F6B3B]"
                value={selectedTrimestre}
                onChange={(e) => setSelectedTrimestre(Number(e.target.value))}
              >
                <option value={1}>1º Trimestre</option>
                <option value={2}>2º Trimestre</option>
                <option value={3}>3º Trimestre</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => selectedTurmaId && void fetchCockpitData(selectedTurmaId, selectedTrimestre)}
            disabled={loadingData || !selectedTurmaId}
            className="md:mt-5 self-end md:self-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
            {loadingData ? "A atualizar..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-100 rounded-xl flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main content area */}
      {loadingData ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <RefreshCw className="w-10 h-10 text-[#1F6B3B] animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 font-sora">A carregar dados do Cockpit...</h2>
          <p className="text-slate-500 text-sm mt-1">Calculando prontidão pedagógica com base nas notas e pautas da turma.</p>
        </div>
      ) : !cockpitData ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 font-sora">Nenhuma Turma Selecionada</h3>
          <p className="text-slate-500 text-sm mt-1">Selecione uma turma ativa acima para carregar o cockpit pedagógico.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-[#1F6B3B] rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disciplinas</p>
                <h4 className="text-xl font-bold text-slate-900 font-sora">{summaryMetrics.totalDisciplines}</h4>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <div className="font-bold text-sm">{summaryMetrics.overallProgress}%</div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prontidão de Lançamentos</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={summaryMetrics.overallProgress} className="h-2" />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-lg ${summaryMetrics.totalPendentes > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas em Falta</p>
                <h4 className="text-xl font-bold text-slate-900 font-sora">
                  {summaryMetrics.totalPendentes} {summaryMetrics.totalPendentes === 1 ? "flag" : "flags"}
                </h4>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-lg ${summaryMetrics.totalRisco > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alunos em Risco (Conselho)</p>
                <h4 className="text-xl font-bold text-slate-900 font-sora">
                  {summaryMetrics.totalRisco} {summaryMetrics.totalRisco === 1 ? "aluno" : "alunos"}
                </h4>
              </div>
            </div>
          </div>

          {/* Selection details */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-800">
              Estado Académico: <span className="text-[#1F6B3B] font-bold">{currentTurmaLabel}</span> · {selectedTrimestre}º Trimestre
            </h2>
            <div className="text-xs text-slate-400">
              Dados atualizados via views materializadas.
            </div>
          </div>

          {/* Interactive Tabs */}
          <Tabs defaultValue="prontidao" className="w-full">
            <TabsList className="bg-slate-100 p-1 rounded-xl mb-4 w-full md:w-auto flex md:inline-flex overflow-x-auto gap-1">
              <TabsTrigger value="prontidao" className="flex items-center gap-2 py-2 px-4 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-[#1F6B3B]" />
                Prontidão de Lançamentos
              </TabsTrigger>
              <TabsTrigger value="pendencias" className="flex items-center gap-2 py-2 px-4 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Notas em Falta ({summaryMetrics.totalPendentes})
              </TabsTrigger>
              <TabsTrigger value="conselho" className="flex items-center gap-2 py-2 px-4 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <Users className="w-4 h-4 text-rose-500" />
                Simulador de Conselho de Turma ({summaryMetrics.totalRisco})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: PRONTIDÃO DE LANÇAMENTOS */}
            <TabsContent value="prontidao" className="space-y-4">
              {Object.keys(prontidaoAgrupada).length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  Nenhum lançamento registado para esta turma e trimestre.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(prontidaoAgrupada).map((group) => {
                    // Check completion of the three types
                    const mac = group.avaliacoes["MAC"] || { percentual_lancado: 0, notas_lancadas: 0, total_alunos: 0 };
                    const npp = group.avaliacoes["NPP"] || { percentual_lancado: 0, notas_lancadas: 0, total_alunos: 0 };
                    const npt = group.avaliacoes["NPT"] || { percentual_lancado: 0, notas_lancadas: 0, total_alunos: 0 };

                    const avgProgress = Math.round(
                      (mac.percentual_lancado + npp.percentual_lancado + npt.percentual_lancado) / 3
                    );

                    return (
                      <div key={group.disciplina_nome} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm font-sora">{group.disciplina_nome}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Professor: {group.professor_nome}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            avgProgress === 100 
                              ? "bg-emerald-50 text-emerald-700" 
                              : avgProgress > 50 
                              ? "bg-amber-50 text-amber-700" 
                              : "bg-slate-50 text-slate-700"
                          }`}>
                            {avgProgress}% Concluído
                          </span>
                        </div>

                        {/* Sub bars */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          {/* MAC */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-600">MAC (Média de Avaliação Contínua)</span>
                              <span className="font-semibold text-slate-800">
                                {mac.notas_lancadas}/{mac.total_alunos} ({mac.percentual_lancado}%)
                              </span>
                            </div>
                            <Progress value={mac.percentual_lancado} className="h-1.5 bg-slate-100" />
                          </div>

                          {/* NPP */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-600">NPP (Nota de Prova Parcial)</span>
                              <span className="font-semibold text-slate-800">
                                {npp.notas_lancadas}/{npp.total_alunos} ({npp.percentual_lancado}%)
                              </span>
                            </div>
                            <Progress value={npp.percentual_lancado} className="h-1.5 bg-slate-100" />
                          </div>

                          {/* NPT */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-600">NPT (Nota de Prova Trimestral)</span>
                              <span className="font-semibold text-slate-800">
                                {npt.notas_lancadas}/{npt.total_alunos} ({npt.percentual_lancado}%)
                              </span>
                            </div>
                            <Progress value={npt.percentual_lancado} className="h-1.5 bg-slate-100" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: DETETOR DE NOTAS EM FALTA */}
            <TabsContent value="pendencias" className="space-y-4">
              {cockpitData.pendentes.length === 0 ? (
                <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-12 text-center text-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold font-sora">Tudo em conformidade!</h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    Não existem notas em falta nesta turma para o {selectedTrimestre}º Trimestre. A pauta está pronta para fecho!
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">
                      Total de flags pendentes: <strong className="text-slate-900">{cockpitData.pendentes.length}</strong>
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      ACÇÃO RECOMENDADA: Notificar Professores
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <th className="p-4">Aluno</th>
                          <th className="p-4">Nº Processo</th>
                          <th className="p-4">Disciplina</th>
                          <th className="p-4">Avaliação</th>
                          <th className="p-4">Professor</th>
                          <th className="p-4 text-right">Acções de Cobrança</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cockpitData.pendentes.map((p, idx) => {
                          const uniqueRowId = `${p.aluno_id}-${p.disciplina_nome}-${p.tipo_avaliacao}`;
                          const isCopied = copiedId === uniqueRowId;
                          const waLink = getWhatsAppLink(p);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition">
                              <td className="p-4 font-semibold text-slate-900">{p.aluno_nome}</td>
                              <td className="p-4 text-slate-500">{p.numero_processo || "-"}</td>
                              <td className="p-4 text-slate-700">{p.disciplina_nome}</td>
                              <td className="p-4">
                                <span className="bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded">
                                  {p.tipo_avaliacao}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-slate-800 font-medium">{p.professor_nome}</div>
                                {p.professor_telefone && (
                                  <div className="text-xs text-slate-400">{p.professor_telefone}</div>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  {/* Copy Reminder Text Button */}
                                  <button
                                    onClick={() => handleCopyReminder(p, uniqueRowId)}
                                    title="Copiar texto de cobrança"
                                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                                      isCopied
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {isCopied ? "Copiado!" : "Copiar"}
                                  </button>

                                  {/* WhatsApp trigger */}
                                  {waLink ? (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-lg bg-[#25D366] hover:bg-[#20ba56] text-white text-xs font-semibold flex items-center gap-1 transition"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>Enviar WhatsApp</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <button
                                      disabled
                                      title="Telefone não registado"
                                      className="p-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold flex items-center gap-1 cursor-not-allowed"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>Sem Telefone</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: SIMULADOR DE CONSELHO DE TURMA */}
            <TabsContent value="conselho" className="space-y-4">
              {cockpitData.alunosRisco.length === 0 ? (
                <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-12 text-center text-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold font-sora">Conselho de Turma Sem Alunos Críticos</h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    Não foram identificados alunos com média final do trimestre inferior a 10.0 valores. Excelente aproveitamento!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Alert summary of unique students at risk */}
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                    <TrendingDown className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-red-900 font-sora">Atenção Pedagógica Necessária</h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        Existem <strong>{summaryMetrics.totalRisco}</strong> alunos nesta turma com classificação final
                        inferior a <strong>10.0 valores</strong> em uma ou mais disciplinas no trimestre.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                            <th className="p-4">Aluno</th>
                            <th className="p-4">Nº Processo</th>
                            <th className="p-4">Disciplina Afectada</th>
                            <th className="p-4">Nota Final Simulada</th>
                            <th className="p-4 text-right">Estatuto / Gravidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cockpitData.alunosRisco.map((r, idx) => {
                            const nota = Number(r.nota_final);
                            const severityLabel = nota < 7.0 ? "Crítico" : "Preocupante";
                            const severityClass =
                              nota < 7.0
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-amber-100 text-amber-800 border-amber-200";

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition">
                                <td className="p-4 font-semibold text-slate-900">{r.aluno_nome}</td>
                                <td className="p-4 text-slate-500">{r.numero_processo || "-"}</td>
                                <td className="p-4 text-slate-700">{r.disciplina_nome}</td>
                                <td className="p-4">
                                  <span className="font-bold text-red-600 font-sora">
                                    {nota.toFixed(1)} valores
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityClass}`}>
                                    {severityLabel} ({nota < 7.0 ? "Faltas Graves" : "Abaixo da Média"})
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </main>
  );
}
