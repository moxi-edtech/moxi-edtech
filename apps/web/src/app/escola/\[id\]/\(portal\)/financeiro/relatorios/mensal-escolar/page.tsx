"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  DollarSign,
  ChevronRight,
  ExternalLink,
  Printer
} from "lucide-react";

type Mensal = {
  anoLetivo: number;
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type PorTurma = {
  turmaId: string;
  turmaNome: string;
  classe: string | null;
  turno: string | null;
  anoLetivo: number;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdPagasAdiantadas: number;
  qtdParciais: number;
  totalPrevisto: number;
  totalPago: number;
  totalPagoAdiantado: number;
  totalParcialEmAberto: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type CaptacaoItem = {
  label: string;
  matriculas: number;
  confirmacoes: number;
  bolsistas: number;
  total: number;
  detalhes_mensais: Record<string, { matriculas: number; confirmacoes: number; bolsistas: number }>;
};

type SessionItem = {
  id: string;
  nome?: string | null;
  status?: string | null;
  ano_letivo?: number | string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

export default function MensalEscolarPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensal, setMensal] = useState<Mensal[]>([]);
  const [porTurma, setPorTurma] = useState<PorTurma[]>([]);
  const [captacao, setCaptacao] = useState<CaptacaoItem[]>([]);

  // --- Alinhamento com Sessão Acadêmica ---
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");

  const sessionSelecionada = useMemo(() => sessions.find((s) => s.id === selectedSession), [sessions, selectedSession]);

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const texto = String(valor);
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const anoLetivoAtivo = useMemo(() => {
    const candidatos = [
      sessionSelecionada?.ano_letivo,
      sessionSelecionada?.nome,
      sessionSelecionada?.data_inicio,
      sessionSelecionada?.data_fim,
    ];

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato);
      if (ano) return ano;
    }
    return new Date().getFullYear();
  }, [sessionSelecionada]);

  useEffect(() => {
    if (!escolaId) return;
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/secretaria/school-sessions?escolaId=${escolaId}`, { cache: 'no-store' });
        const json = await res.json();
        if (json.ok) {
          const sessionItems = (json.data || []) as SessionItem[];
          setSessions(sessionItems);
          const activeSession = sessionItems.find((s) => s.status === "ativa");
          if (activeSession) setSelectedSession(activeSession.id);
          else if (sessionItems.length > 0) setSelectedSession(sessionItems[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    }
    fetchSessions();
  }, [escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/financeiro/relatorios/propinas?ano=${encodeURIComponent(anoLetivoAtivo)}&escolaId=${escolaId}`, { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Erro ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) {
          setMensal(j.mensal || []);
          setPorTurma(j.porTurma || []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; }
  }, [selectedSession, anoLetivoAtivo, escolaId]);

  useEffect(() => {
    if (!selectedSession || !escolaId) return;

    async function loadCaptacao() {
      try {
        const res = await fetch(`/api/financeiro/relatorios/captacao?ano=${encodeURIComponent(anoLetivoAtivo)}&escolaId=${escolaId}`, { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          setCaptacao(j.items || []);
        }
      } catch (e) {
        console.error("Erro ao carregar captação", e);
      }
    }
    loadCaptacao();
  }, [selectedSession, anoLetivoAtivo, escolaId]);

  // Resumo Executivo (Acumulado do ano selecionado)
  const resumo = useMemo(() => {
    return mensal.reduce((acc, curr) => {
      acc.totalPrevisto += curr.totalPrevisto;
      acc.totalPago += curr.totalPago;
      acc.totalEmAtraso += curr.totalEmAtraso;
      acc.totalParcialEmAberto += curr.totalParcialEmAberto;
      return acc;
    }, {
      totalPrevisto: 0,
      totalPago: 0,
      totalEmAtraso: 0,
      totalParcialEmAberto: 0
    });
  }, [mensal]);

  const taxaInadimplenciaGeral = useMemo(() => {
    if (resumo.totalPrevisto === 0) return 0;
    return (resumo.totalEmAtraso / resumo.totalPrevisto) * 100;
  }, [resumo]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' }).replace('AOA', '').trim();
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .shadow-sm { box-shadow: none !important; border: 1px solid #eee !important; }
          .rounded-xl { border-radius: 0 !important; }
          .bg-white { background-color: white !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatório Financeiro Mensal Escolar</h1>
          <p className="text-sm text-gray-600">Visão executiva consolidada ({anoLetivoAtivo})</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir PDF
          </button>
          <div className="no-print flex items-center gap-2 text-sm bg-white p-2 border rounded-lg shadow-sm">
            <label className="text-gray-600 font-medium">Sessão Acadêmica</label>
            <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-48 border-none focus:ring-0 bg-transparent font-semibold"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl border"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Bloco 1 — Resumo executivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Previsto
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(resumo.totalPrevisto)}</div>
              <div className="text-[10px] text-gray-400 mt-1">Acumulado do ano</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Pago
              </div>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(resumo.totalPago)}</div>
              <div className="text-[10px] text-gray-400 mt-1">Total arrecadado</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                Em Atraso
              </div>
              <div className="text-2xl font-bold text-rose-600">{formatCurrency(resumo.totalEmAtraso)}</div>
              <div className="text-[10px] text-gray-400 mt-1">Valor pendente expirado</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Saldo Parcial
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(resumo.totalParcialEmAberto)}</div>
              <div className="text-[10px] text-gray-400 mt-1">A vencer / parciais</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                <ArrowUpRight className="w-4 h-4 text-purple-500" />
                Inadimplência
              </div>
              <div className="text-2xl font-bold text-gray-900">{taxaInadimplenciaGeral.toFixed(1)}%</div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-purple-500 h-full rounded-full" 
                  style={{ width: `${Math.min(taxaInadimplenciaGeral, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Bloco 2 — Captação Acadêmica (Matrículas e Confirmações) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Captação Acadêmica por Classe</h2>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Entradas do Ano</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 border-b">
                        <th className="py-2 px-4 font-medium uppercase text-[10px]">Classe</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Matrículas (Novos)</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Confirmações</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Total Alunos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {captacao.length > 0 ? captacao.map((c) => (
                        <tr key={c.label} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-700">{c.label}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{c.matriculas}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{c.confirmacoes}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">{c.total}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="py-4 text-center text-gray-400 italic text-xs">Sem dados de captação para este período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bloco 3 — Leitura Institucional (Bolsistas) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Inscritos e Bolsistas</h2>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Resumo Institucional</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 border-b">
                        <th className="py-2 px-4 font-medium uppercase text-[10px]">Classe</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Total Alunos</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Bolsistas / Descontos</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">% Bolsistas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {captacao.length > 0 ? captacao.map((c) => (
                        <tr key={`${c.label}-bolsas`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-700">{c.label}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{c.total}</td>
                          <td className="py-3 px-4 text-right text-blue-600 font-medium">{c.bolsistas}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {c.total > 0 ? ((c.bolsistas / c.total) * 100).toFixed(1) : 0}%
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="py-4 text-center text-gray-400 italic text-xs">Sem dados institucionais para este período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bloco 4 — Propinas (Série Mensal) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Série Mensal de Arrecadação</h2>
                  <Link 
                    href={`/escola/${escolaId}/financeiro/relatorios/propinas`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Ver detalhes <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 border-b">
                        <th className="py-2 px-4 font-medium uppercase text-[10px]">Competência</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Previsto</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Pago</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Atraso</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mensal.map((m) => (
                        <tr key={`${m.ano}-${m.mes}`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-700">{m.labelMes}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(m.totalPrevisto)}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-medium">{formatCurrency(m.totalPago)}</td>
                          <td className="py-3 px-4 text-right text-rose-600">{formatCurrency(m.totalEmAtraso)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.inadimplenciaPct > 20 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {m.inadimplenciaPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bloco 3 — Ranking por Turma */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Maiores Inadimplências por Turma</h2>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Top 10</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 border-b">
                        <th className="py-2 px-4 font-medium uppercase text-[10px]">Turma</th>
                        <th className="py-2 px-4 font-medium uppercase text-[10px]">Classe</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">Total Atraso</th>
                        <th className="py-2 px-4 text-right font-medium uppercase text-[10px]">% Inadimplência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {porTurma.slice(0, 10).map((t) => (
                        <tr key={t.turmaId} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-700">{t.turmaNome}</td>
                          <td className="py-3 px-4 text-gray-500">{t.classe || '—'}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-medium">{formatCurrency(t.totalEmAtraso)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className="bg-rose-500 h-full rounded-full" 
                                  style={{ width: `${Math.min(t.inadimplenciaPct, 100)}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-rose-700">{t.inadimplenciaPct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Bloco de Links Rápidos / Atalhos */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  Relatórios Especialistas
                </h2>
                <div className="space-y-3">
                  <Link 
                    href={`/escola/${escolaId}/financeiro/relatorios/propinas`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Propinas</div>
                      <div className="text-[10px] text-gray-500">Detalhado por mês e turma</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                  </Link>

                  <Link 
                    href={`/escola/${escolaId}/financeiro/relatorios/fluxo-caixa`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Fluxo de Caixa</div>
                      <div className="text-[10px] text-gray-500">Ritmo de recebimento diário</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                  </Link>

                  <Link 
                    href={`/escola/${escolaId}/financeiro/radar`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Radar de Inadimplência</div>
                      <div className="text-[10px] text-gray-500">Ações de cobrança e histórico</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                  </Link>
                </div>
              </div>

              {/* Informação Adicional */}
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Dica de Gestão
                </h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Utilize este relatório para uma visão rápida da saúde financeira da escola. 
                  Se a taxa de inadimplência ultrapassar 15%, recomendamos verificar o 
                  <strong> Radar de Inadimplência</strong> para identificar as turmas críticas.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
