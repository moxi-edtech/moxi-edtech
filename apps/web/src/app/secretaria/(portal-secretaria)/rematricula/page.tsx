"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { 
  ArrowRight, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Save,
  Lock,
  CalendarClock,
  X,
  Loader2,
} from "lucide-react";

// 1. Tipagens atualizadas para o Payload Enriquecido (UX Defensiva)
interface Turma {
  id: string;
  nome: string;
  classe_nome?: string | null;
  curso_id?: string;
  classe_id?: string;
  ano_letivo?: number;
  turno?: string | null;
}

type Session = { id: string; ano_letivo: number; status: string };

function classeNumero(nome?: string | null) {
  const match = String(nome ?? "").match(/(\d{1,2})\s*(?:ª|a|º)?/i);
  return match ? Number(match[1]) : null;
}

function proximaClasse(numero: number | null) {
  if (numero == null) return null;
  if (numero === 12) return null;
  if (numero === 6) return 7;
  if (numero === 9) return 10;
  return numero + 1;
}

type NotesModalProps = {
  turmaId: string;
  alunoId: string;
  alunoNome: string;
  onClose: () => void;
  onSaved: () => void;
};

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

type TriagemRow = {
  id?: string;
  aluno_id?: string;
  nome?: string;
  aluno_nome?: string;
  status?: string | null;
  status_matricula?: string | null;
  pode_transitar?: boolean;
  motivos_bloqueio?: string[];
  pedagogico?: {
    status?: string | null;
  };
  financeiro?: {
    em_dia?: boolean;
    saldo_pendente?: number | string | null;
  };
};

function NotesModal({ turmaId, alunoId, alunoNome, onClose, onSaved }: NotesModalProps) {
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [periodos, setPeriodos] = useState<{ id: string; numero: number }[]>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(1);
  const [pauta, setPauta] = useState<StudentGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setDisciplinas(json.items ?? []);
        setPeriodos(json.periodos ?? []);
        const first = json.periodos?.[0]?.numero;
        if (typeof first === "number") setPeriodo(first);
      })
      .catch(() => setMessage("Não foi possível carregar as disciplinas."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [turmaId]);

  useEffect(() => {
    if (!disciplinaId) {
      setPauta([]);
      return;
    }
    const selected = disciplinas.find((item) => item.disciplina?.id === disciplinaId);
    setTurmaDisciplinaId(selected?.id ?? null);
    let active = true;
    setLoading(true);
    fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?disciplinaId=${disciplinaId}&trimestre=${periodo}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setPauta((json.items ?? []).map((row: any, index: number) => ({
          id: row.aluno_id,
          numero: row.numero_chamada ?? index + 1,
          nome: row.nome ?? "Aluno",
          foto: row.foto ?? null,
          mac1: row.mac ?? null,
          npp1: row.npp ?? null,
          npt1: row.npt ?? null,
          mt1: row.mt ?? null,
          is_isento: !!row.is_isento,
          _status: "synced",
        })));
      })
      .catch(() => setMessage("Não foi possível carregar as notas."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [turmaId, disciplinaId, periodo, disciplinas]);

  const saveNotes = async (rows: StudentGradeRow[]) => {
    if (!disciplinaId || !turmaDisciplinaId) return;
    setSaving(true);
    try {
      const entries = [
        ["MAC", "mac1"],
        ["NPP", "npp1"],
        ["NPT", "npt1"],
      ] as const;
      for (const [tipo, field] of entries) {
        const notas = rows
          .filter((row) => row.id === alunoId && !row.is_isento && typeof row[field] === "number")
          .map((row) => ({ aluno_id: row.id, valor: row[field] }));
        if (notas.length === 0) continue;
        const response = await fetch("/api/secretaria/notas", {
          method: "POST",
          headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({
            turma_id: turmaId,
            ano_letivo_id: academicYearId,
            disciplina_id: disciplinaId,
            turma_disciplina_id: turmaDisciplinaId,
            trimestre: periodo,
            tipo_avaliacao: tipo,
            notas,
          }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao salvar notas");
      }
      setMessage("Notas guardadas. A elegibilidade será recalculada.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar notas.");
    } finally {
      setSaving(false);
    }
  };

  const focusedRows = pauta.filter((row) => row.id === alunoId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-klasse-gold-700">Resolver notas incompletas</p>
            <h2 className="text-lg font-bold text-slate-950">{alunoNome}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
          <select value={disciplinaId} onChange={(event) => setDisciplinaId(event.target.value)} className="rounded-lg border-slate-200 text-sm">
            <option value="">Selecione a disciplina</option>
            {disciplinas.map((item) => <option key={item.id} value={item.disciplina?.id ?? ""}>{item.disciplina?.nome ?? "Disciplina"}</option>)}
          </select>
          <select value={periodo} onChange={(event) => setPeriodo(Number(event.target.value))} className="rounded-lg border-slate-200 text-sm" disabled={!periodos.length}>
            {periodos.length ? periodos.map((item) => <option key={item.id} value={item.numero}>Trimestre {item.numero}</option>) : <option value={1}>Sem períodos disponíveis</option>}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />A carregar a pauta...</div> : !disciplinaId ? <p className="p-6 text-sm text-slate-500">Escolha a disciplina para lançar a nota.</p> : focusedRows.length === 0 ? <p className="p-6 text-sm text-slate-500">Não há pauta disponível para este aluno.</p> : <GradeEntryGrid initialData={focusedRows} title="Notas do aluno" subtitle={`Trimestre ${periodo}`} onSave={saveNotes} showIsento={true} />}
          {saving && <p className="mt-3 text-xs text-slate-500">A guardar notas...</p>}
          {message && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default function RematriculaPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
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
  const [originYear, setOriginYear] = useState<number | null>(null);
  const [destinationYear, setDestinationYear] = useState<number | null>(null);
  const [notesStudent, setNotesStudent] = useState<AlunoTriagem | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  
  // Limpa o destino se a origem mudar
  useEffect(() => {
    setDestinationTurmaId("");
  }, [originTurmaId]);
  
  // Memo para filtrar turmas de destino baseadas na origem
  const destinationOptions = React.useMemo(() => {
    if (!originTurmaId) return [];
    const origin = turmas.find(t => t.id === originTurmaId);
    if (!origin) return [];

    const targetClass = proximaClasse(classeNumero(origin.classe_nome));
    if (targetClass == null) return [];

    const candidates = turmas.filter(t =>
      t.curso_id === origin.curso_id &&
      t.id !== origin.id &&
      Number(t.ano_letivo ?? 0) > Number(origin.ano_letivo ?? 0) &&
      classeNumero(t.classe_nome) === targetClass
    );

    // Mantém o mesmo turno sempre que essa correspondência existir.
    const sameTurno = candidates.filter((candidate) => candidate.turno === origin.turno);
    return sameTurno.length > 0 ? sameTurno : candidates;
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

  // Contexto canónico: ano anterior → ano ativo (ou próximo ano preparado).
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const sessionsRes = await fetch("/api/secretaria/school-sessions", { cache: "no-store" });
        const sessionsJson = await sessionsRes.json();
        const available = ((sessionsJson.data ?? []) as Session[]).sort((a, b) => b.ano_letivo - a.ano_letivo);
        const active = available.find((session) => session.status === "ativa") ?? available[0];
        const previous = active ? available.find((session) => session.ano_letivo < active.ano_letivo) : undefined;
        const source = previous ?? active;
        const target = active ?? available[0];
        if (source) setOriginYear(source.ano_letivo);
        if (target) setDestinationYear(target.ano_letivo);

        const years = Array.from(new Set([source?.ano_letivo, target?.ano_letivo].filter((year): year is number => typeof year === "number")));
        const responses = await Promise.all(years.map((year) => fetch(`/api/secretaria/turmas-simples?ano=${year}`, { cache: "no-store" }).then((res) => res.json())));
        const loaded = responses.flatMap((json) => json.ok ? (json.items ?? json.data ?? []) : []);
        setTurmas(loaded);
        const sourceTurmas = loaded.filter((turma: Turma) => turma.ano_letivo === source?.ano_letivo);
        if (sourceTurmas.length === 1) setOriginTurmaId(sourceTurmas[0].id);
      } catch {
        setError("Falha ao carregar o catálogo de turmas e anos letivos.");
      }
    };
    fetchContext();
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

          const rows: AlunoTriagem[] = ((json.alunos || json.items || []) as TriagemRow[]).flatMap((row) => {
            const id = row.aluno_id || row.id;
            if (!id) return [];
            const pedagogicoStatus = normalizePedagogico(row.pedagogico?.status ?? row.status_matricula ?? row.status);
            const financeiroEmDia = row.financeiro?.em_dia ?? true;
            const saldoPendente = Number(row.financeiro?.saldo_pendente ?? 0);
            const podeTransitar = row.pode_transitar ?? (pedagogicoStatus === "CONCLUIDA" && financeiroEmDia);
            const motivos: string[] = [];
            if (!financeiroEmDia) motivos.push("inadimplencia");
            if (pedagogicoStatus === "REPROVADA") motivos.push("reprovacao");
            return [{
              id,
              nome: row.aluno_nome || row.nome || "Aluno",
              pode_transitar: podeTransitar,
              motivos_bloqueio: motivos,
              pedagogico: { status: pedagogicoStatus },
              financeiro: { em_dia: financeiroEmDia, saldo_pendente: saldoPendente },
            }];
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
  }, [originTurmaId, reloadToken]);

  const originOptions = useMemo(
    () => turmas.filter((turma) => originYear == null || turma.ano_letivo === originYear),
    [turmas, originYear],
  );

  useEffect(() => {
    if (!originTurmaId || destinationTurmaId) return;
    const options = destinationOptions;
    if (options.length === 1) setDestinationTurmaId(options[0].id);
  }, [originTurmaId, destinationTurmaId, destinationOptions]);

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

  const submitPromotion = async (alunoIds: string[]) => {
    if (alunoIds.length === 0 || !originTurmaId || !destinationTurmaId) return;
    
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
          aluno_ids: alunoIds,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "A transação falhou num dos Gates do servidor.");

      success("Transição concluída", `${json.sucesso} alunos foram transitados para a nova turma com sucesso.`);
      setSelectedAlunos([]);
      setReloadToken((value) => value + 1);
    } catch (e) {
      toastError("Falha na rematrícula", "Houve um erro técnico ao tentar processar a transição dos alunos. Por favor, tente novamente.");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPromotion(selectedAlunos);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-5xl mx-auto font-sans">
      
      {/* HEADER DA PÁGINA */}
      <div className="mb-8 border-b border-slate-100 pb-4">
        <DashboardHeader
          title="Promoção em Massa"
          description="A secretaria promove alunos aprovados do ano anterior para o ano letivo ativo, com resolução inline das pendências."
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Rematrícula" },
          ]}
        />
        <div className="mt-4 grid gap-3 rounded-xl border border-klasse-gold-100 bg-klasse-gold-50/60 p-4 text-sm sm:grid-cols-3">
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Origem sugerida</span><strong>{originYear ? `${originYear}/${originYear + 1}` : "A carregar..."}</strong></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Destino sugerido</span><strong>{destinationYear ? `${destinationYear}/${destinationYear + 1}` : "A carregar..."}</strong></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Critério</span><span className="text-slate-700">Notas completas e situação financeira regular</span></div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push(buildPortalHref(escolaParam, "/secretaria/rematricula/janelas"))}
            className="inline-flex items-center gap-2 rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 px-4 py-2 text-xs font-bold text-klasse-gold-700 hover:bg-klasse-gold-100"
          >
            <CalendarClock className="h-4 w-4" />
            Gerir janelas de rematrícula online
          </button>
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
              <option value="">Selecione a turma do ano anterior...</option>
              {originOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}{t.turno ? ` · ${t.turno}` : ""}</option>
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
              <option value="">Selecione a turma de destino...</option>
              {destinationOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}{t.ano_letivo ? ` · ${t.ano_letivo}` : ""}</option>
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
                    <th className="py-3 px-4 text-right">Ação</th>
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
                        <td className="py-3 px-4 text-right">
                          {aluno.pode_transitar ? (
                            <button
                              type="button"
                              disabled={loading || !destinationTurmaId}
                              onClick={() => submitPromotion([aluno.id])}
                              className="rounded-lg bg-klasse-green px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                            >
                              Promover
                            </button>
                          ) : aluno.pedagogico.status === "INCOMPLETA" ? (
                            <button
                              type="button"
                              onClick={() => setNotesStudent(aluno)}
                              className="rounded-lg border border-klasse-gold-200 bg-klasse-gold-50 px-3 py-2 text-xs font-semibold text-klasse-gold-800 hover:bg-klasse-gold-100"
                            >
                              Lançar notas
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Resolver pendência</span>
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
      {notesStudent && (
        <NotesModal
          turmaId={originTurmaId}
          alunoId={notesStudent.id}
          alunoNome={notesStudent.nome}
          onClose={() => setNotesStudent(null)}
          onSaved={() => {
            setReloadToken((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
