"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { 
  UsersRound, 
  ArrowRight, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Save,
  Lock 
} from "lucide-react";

// 1. Tipagens atualizadas para o Payload Enriquecido (UX Defensiva)
interface Turma {
  id: string;
  nome: string;
  curso_id?: string;
  classe_id?: string;
  ano_letivo?: number;
}

interface AlunoTriagem {
  id: string;
  nome: string;
  pode_transitar: boolean;
  motivos_bloqueio: string[];
  pedagogico: {
    status: "CONCLUIDA" | "REPROVADA" | "INCOMPLETA" | string;
  };
  financeiro: {
    em_dia: boolean;
    saldo_pendente: number;
  };
}

export default function RematriculaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const slugFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const escolaParam = escolaSlug || slugFromPath || escolaId;
  
  // States de Seleção
  const [originTurmaId, setOriginTurmaId] = useState("");
  const [destinationTurmaId, setDestinationTurmaId] = useState("");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  
  // Limpa o destino se a origem mudar
  useEffect(() => {
    setDestinationTurmaId("");
  }, [originTurmaId]);
  
  // Memo para filtrar turmas de destino baseadas na origem
  const destinationOptions = React.useMemo(() => {
    if (!originTurmaId) return [];
    const origin = turmas.find(t => t.id === originTurmaId);
    if (!origin) return [];
    
    // Filtra pelo mesmo curso e exclui a própria turma de origem
    return turmas.filter(t => t.curso_id === origin.curso_id && t.id !== origin.id);
  }, [originTurmaId, turmas]);
  
  // States de Dados
  const [alunos, setAlunos] = useState<AlunoTriagem[]>([]);
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  
  // States de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [motivoFilter, setMotivoFilter] = useState("todos");

  // Load Inicial de Turmas
  useEffect(() => {
    const fetchTurmas = async () => {
      try {
        const res = await fetch("/api/secretaria/turmas-simples");
        const json = await res.json();
        if (json.ok) setTurmas(json.items);
      } catch {
        setError("Falha ao carregar o catálogo de turmas.");
      }
    };
    fetchTurmas();
  }, []);

  // 2. O Cérebro: Carregar Alunos e Fazer Auto-Select
  useEffect(() => {
    const fetchAlunos = async () => {
      if (!originTurmaId) {
        setAlunos([]);
        setSelectedAlunos([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/secretaria/turmas/${originTurmaId}/alunos`, { cache: "no-store" });
        const json = await res.json();
        
        if (json.ok) {
          // Mapeamento defensivo garantindo a estrutura nova (ou fazendo fallback seguro)
          const normalizePedagogico = (status?: string | null) => {
            const normalized = String(status || "").trim().toLowerCase();
            if (["concluido", "concluida", "aprovado", "aprovada", "concluida"].includes(normalized)) return "CONCLUIDA";
            if (["reprovado", "reprovada"].includes(normalized)) return "REPROVADA";
            if (!normalized) return "INCOMPLETA";
            return status as string;
          };

          const rows = (json.alunos || json.items || []).map((row: any) => {
            const pedagogicoStatus = normalizePedagogico(row.pedagogico?.status ?? row.status_matricula ?? row.status);
            const financeiroEmDia = row.financeiro?.em_dia ?? true;
            const saldoPendente = Number(row.financeiro?.saldo_pendente ?? 0);
            const podeTransitar = row.pode_transitar ?? (pedagogicoStatus === "CONCLUIDA" && financeiroEmDia);
            const motivos: string[] = [];
            if (!financeiroEmDia) motivos.push("inadimplencia");
            if (pedagogicoStatus === "REPROVADA") motivos.push("reprovacao");
            return {
              id: row.aluno_id || row.id,
              nome: row.aluno_nome || row.nome,
              pode_transitar: podeTransitar,
              motivos_bloqueio: motivos,
              pedagogico: { status: pedagogicoStatus },
              financeiro: { em_dia: financeiroEmDia, saldo_pendente: saldoPendente },
            };
          });
          
          setAlunos(rows);
          
          // O AUTO-SELECT MÁGICO: Marca apenas quem tem luz verde nos Gates
          const aptosIds = rows.filter((a: AlunoTriagem) => a.pode_transitar).map((a: AlunoTriagem) => a.id);
          setSelectedAlunos(aptosIds);
        }
      } catch {
        setError("Falha ao carregar a triagem de alunos.");
      } finally {
        setLoading(false);
      }
    };
    fetchAlunos();
  }, [originTurmaId]);

  // Filtros Visuais
  const filteredAlunos = alunos.filter((aluno) => {
    const matchesSearch = !searchTerm.trim() || aluno.nome.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === "todos") return matchesSearch;
    if (statusFilter === "aptos") return matchesSearch && aluno.pode_transitar;
    if (statusFilter === "pendentes") return matchesSearch && !aluno.pode_transitar;
    return matchesSearch;
  }).filter((aluno) => {
    if (motivoFilter === "todos") return true;
    if (motivoFilter === "inadimplencia") return aluno.motivos_bloqueio.includes("inadimplencia");
    if (motivoFilter === "reprovacao") return aluno.motivos_bloqueio.includes("reprovacao");
    if (motivoFilter === "notas_incompletas") return aluno.pedagogico.status === "INCOMPLETA" && aluno.motivos_bloqueio.length === 0;
    return true;
  });

  const totals = React.useMemo(() => {
    const base = { total: alunos.length, aptos: 0, pendentes: 0, inadimplencia: 0, reprovacao: 0, notas_incompletas: 0 };
    for (const aluno of alunos) {
      if (aluno.pode_transitar) base.aptos += 1;
      else base.pendentes += 1;
      if (aluno.motivos_bloqueio.includes("inadimplencia")) base.inadimplencia += 1;
      if (aluno.motivos_bloqueio.includes("reprovacao")) base.reprovacao += 1;
      if (aluno.pedagogico.status === "INCOMPLETA" && aluno.motivos_bloqueio.length === 0) base.notas_incompletas += 1;
    }
    return base;
  }, [alunos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAlunos.length === 0 || !originTurmaId || !destinationTurmaId) return;
    
    const origin = turmas.find(t => t.id === originTurmaId);
    const destination = turmas.find(t => t.id === destinationTurmaId);

    if (!origin?.ano_letivo || !destination?.ano_letivo) {
      setError("Dados de ano letivo ausentes nas turmas selecionadas.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/secretaria/matriculas/transitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_origem_id: originTurmaId,
          turma_destino_id: destinationTurmaId,
          ano_letivo_origem: origin.ano_letivo,
          ano_letivo_destino: destination.ano_letivo,
          aluno_ids: selectedAlunos,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "A transação falhou num dos Gates do servidor.");

      alert(`Sucesso! ${json.sucesso} alunos transitados, ${json.falhas} falhas.`);
      router.push(buildPortalHref(escolaParam, "/secretaria/turmas"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-5xl mx-auto font-sans">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
        <div className="bg-[#1F6B3B]/10 p-3 rounded-xl">
          <UsersRound className="w-6 h-6 text-[#1F6B3B]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-950 font-sora">Promoção em Massa</h1>
          <p className="text-sm text-slate-500">Transfira alunos aprovados para o próximo ano letivo.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ZONA 1: ORIGEM E DESTINO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div>
            <label className="block text-sm font-semibold text-slate-950 mb-2">
              Turma de Origem
            </label>
            <select
              value={originTurmaId}
              onChange={(e) => setOriginTurmaId(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 transition-all"
              required
            >
              <option value="">Selecione a turma atual...</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            {/* Ícone decorativo apontando a direção no Desktop */}
            <div className="absolute -left-6 top-9 hidden md:block text-slate-300">
              <ArrowRight className="w-5 h-5" />
            </div>
            
            <label className="block text-sm font-semibold text-slate-950 mb-2">
              Turma de Destino
            </label>
            <select
              value={destinationTurmaId}
              onChange={(e) => setDestinationTurmaId(e.target.value)}
              disabled={!originTurmaId}
              className="w-full rounded-xl border-slate-200 text-sm focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
              required
            >
              <option value="">Selecione a nova turma...</option>
              {destinationOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ZONA 2: GRELHA DE TRIAGEM */}
        {originTurmaId && alunos.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-950 font-sora">Triagem de Alunos</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setStatusFilter("todos"); setMotivoFilter("todos"); }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                >
                  Total {totals.total}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("aptos"); setMotivoFilter("todos"); }}
                  className="rounded-full border border-klasse-green-200 bg-klasse-green-50 px-3 py-1 text-klasse-green-800"
                >
                  Aptos {totals.aptos}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("pendentes"); setMotivoFilter("todos"); }}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800"
                >
                  Pendentes {totals.pendentes}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("pendentes"); setMotivoFilter("inadimplencia"); }}
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-800"
                >
                  Inadimplência {totals.inadimplencia}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("pendentes"); setMotivoFilter("reprovacao"); }}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-800"
                >
                  Reprovação {totals.reprovacao}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("pendentes"); setMotivoFilter("notas_incompletas"); }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                >
                  Notas incompletas {totals.notas_incompletas}
                </button>
              </div>
              
              {/* Filtros */}
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar aluno..."
                    className="pl-9 w-48 rounded-xl border-slate-200 text-sm focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-9 rounded-xl border-slate-200 text-sm focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
                  >
                    <option value="todos">Todos</option>
                    <option value="aptos">Aptos a Transitar</option>
                    <option value="pendentes">Com Pendências</option>
                  </select>
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    value={motivoFilter}
                    onChange={(e) => setMotivoFilter(e.target.value)}
                    className="pl-9 rounded-xl border-slate-200 text-sm focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
                  >
                    <option value="todos">Todos os motivos</option>
                    <option value="inadimplencia">Inadimplência</option>
                    <option value="reprovacao">Reprovação</option>
                    <option value="notas_incompletas">Notas incompletas</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-left w-12">
                      <input 
                        type="checkbox" 
                        className="rounded text-[#1F6B3B] focus:ring-[#E3B23C]"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAlunos(filteredAlunos.filter(a => a.pode_transitar).map(a => a.id));
                          } else {
                            setSelectedAlunos([]);
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 px-4 text-left">Nome do Aluno</th>
                    <th className="py-3 px-4 text-center">Status Pedagógico</th>
                    <th className="py-3 px-4 text-center">Status Financeiro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlunos.map((aluno) => {
                    const isSelected = selectedAlunos.includes(aluno.id);
                    const bloqueioMotivo = aluno.motivos_bloqueio.length > 0
                      ? aluno.motivos_bloqueio.includes("inadimplencia")
                        ? "Dívida em aberto"
                        : "Reprovado"
                      : aluno.pedagogico.status === "INCOMPLETA"
                        ? "Notas incompletas"
                        : ""
                    return (
                      <tr key={aluno.id} className={`hover:bg-slate-50 transition-colors ${!aluno.pode_transitar ? 'opacity-75 bg-slate-50/50' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!aluno.pode_transitar}
                              checked={isSelected}
                              className="rounded text-[#1F6B3B] focus:ring-[#E3B23C] disabled:opacity-50"
                              onChange={(e) => {
                                if (e.target.checked) setSelectedAlunos([...selectedAlunos, aluno.id]);
                                else setSelectedAlunos(selectedAlunos.filter((id) => id !== aluno.id));
                              }}
                            />
                            {!aluno.pode_transitar && (
                              <div title={bloqueioMotivo}>
                                <Lock className="w-4 h-4 text-red-600" aria-label="Bloqueado" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div>{aluno.nome}</div>
                          {!aluno.pode_transitar && bloqueioMotivo && (
                            <div className="text-xs text-red-600 mt-1">{bloqueioMotivo}</div>
                          )}
                        </td>
                        
                        {/* BADGE PEDAGÓGICA */}
                        <td className="py-3 px-4 text-center">
                          {aluno.pedagogico.status === 'CONCLUIDA' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-klasse-green-100 text-klasse-green-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3.5 h-3.5" /> {aluno.pedagogico.status}
                            </span>
                          )}
                        </td>

                        {/* BADGE FINANCEIRA */}
                        <td className="py-3 px-4 text-center">
                          {aluno.financeiro.em_dia ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-klasse-green-100 text-klasse-green-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Em Dia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title={`Dívida: ${aluno.financeiro.saldo_pendente} Kz`}>
                              <AlertCircle className="w-3.5 h-3.5" /> Dívida Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAlunos.length === 0 && (
                <div className="py-8 text-center text-slate-500">
                  Nenhum aluno encontrado.
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* ZONA 3: BARRA DE AÇÃO FLUTUANTE / FIXA */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <div className="text-sm text-slate-500">
            <span className="font-bold text-slate-950">{selectedAlunos.length}</span> alunos prontos para transitar
          </div>
          <button
            type="submit"
             disabled={loading || selectedAlunos.length === 0 || !destinationTurmaId}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20 disabled:opacity-50 transition-all"
          >
            {loading ? "A Processar..." : "Confirmar Rematrícula"}
            {!loading && <Save className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
