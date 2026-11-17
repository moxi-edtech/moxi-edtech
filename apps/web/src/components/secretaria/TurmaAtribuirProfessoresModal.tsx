"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, UserCheck, UserX, BookOpen, AlertCircle, Loader2, Check, Plus, ChevronDown } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { planTurmaModalBatch, selectedProfessorForLegacyId } from "@/lib/professores/turma-modal-assignment";
import type { AssignmentCandidate } from "@/lib/professores/assignment-candidates";
import type { TurmaItem } from "~/types/turmas";

interface TurmaAtribuirProfessoresModalProps {
  turma: TurmaItem;
  escolaId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

interface DisciplinaItem {
  id: string;
  curso_matriz_id: string;
  disciplina: { id: string; nome: string };
  curriculo_status?: string | null;
  meta?: { carga_horaria_semanal?: number | null };
  professor?: { id: string | null; nome: string | null; email: string | null } | null;
}

interface ProfessorOption {
  user_id: string;
  professor_id: string | null;
  nome: string;
  email?: string | null;
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 disabled:opacity-50";

async function fetchProfessores(escolaId: string): Promise<ProfessorOption[]> {
  // The Secretaria endpoint caps each page at 50. Never silently omit teachers after page 1.
  const byUserId = new Map<string, ProfessorOption>();
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`/api/secretaria/professores?escola_id=${escolaId}&cargo=professor&days=0&pageSize=50&page=${page}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
      throw new Error(json?.error || "Não foi possível carregar professores.");
    }
    for (const item of json.items) {
      if (typeof item.user_id !== "string") continue;
      byUserId.set(item.user_id, {
        user_id: item.user_id,
        professor_id: typeof item.professor_id === "string" ? item.professor_id : null,
        nome: item.nome || item.email || "Professor",
        email: item.email ?? null,
      });
    }
    if (json.items.length < 50) return [...byUserId.values()];
  }
  throw new Error("A lista de professores excede o limite de carregamento. Refine a gestão de docentes.");
}

export default function TurmaAtribuirProfessoresModal({
  turma, escolaId, isOpen, onClose, onUpdated,
}: TurmaAtribuirProfessoresModalProps) {
  const { success, error: toastError } = useToast();
  const toastErrorRef = useRef(toastError);
  useEffect(() => { toastErrorRef.current = toastError; }, [toastError]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [professores, setProfessores] = useState<ProfessorOption[]>([]);
  const [search, setSearch] = useState("");
  const [bulkDisciplinaId, setBulkDisciplinaId] = useState<string | null>(null);
  const [bulkProfessorUserId, setBulkProfessorUserId] = useState("");
  const [bulkCandidates, setBulkCandidates] = useState<AssignmentCandidate[]>([]);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const refreshDisciplinas = useCallback(async () => {
    const res = await fetch(`/api/secretaria/turmas/${turma.id}/disciplinas?escola_id=${escolaId}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
      throw new Error(json?.error || "Não foi possível carregar as disciplinas da turma.");
    }
    setDisciplinas(json.items);
    return json.items as DisciplinaItem[];
  }, [escolaId, turma.id]);

  const loadData = useCallback(async () => {
    if (!isOpen || !turma.id || !escolaId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [items, options] = await Promise.all([refreshDisciplinas(), fetchProfessores(escolaId)]);
      setDisciplinas(items);
      setProfessores(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar professores e disciplinas.";
      setLoadError(message);
      toastErrorRef.current("Erro", message);
    } finally {
      setLoading(false);
    }
  }, [isOpen, turma.id, escolaId, refreshDisciplinas]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!isOpen) {
      setBulkDisciplinaId(null);
      setBulkCandidates([]);
      setBulkSelected([]);
      setBulkError(null);
    }
  }, [isOpen]);

  const activeDisciplina = useMemo(
    () => disciplinas.find((disc) => disc.curso_matriz_id === bulkDisciplinaId) ?? null,
    [disciplinas, bulkDisciplinaId],
  );

  useEffect(() => {
    if (!isOpen || !bulkDisciplinaId || !activeDisciplina?.disciplina?.id) return;
    const controller = new AbortController();
    setBulkLoading(true);
    setBulkError(null);
    setBulkCandidates([]);
    setBulkSelected([]);
    fetch(`/api/escolas/${escolaId}/professores/atribuicoes-em-massa?disciplina_id=${activeDisciplina.disciplina.id}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Não foi possível consultar as turmas elegíveis.");
      }
      if (controller.signal.aborted) return;
      const options = json.items as AssignmentCandidate[];
      const current = options.find((item) => item.turma_id === turma.id);
      if (!current || current.curso_matriz_id !== bulkDisciplinaId) {
        throw new Error("Esta turma não tem a disciplina na matriz publicada do ano letivo ativo.");
      }
      setBulkCandidates(options);
      setBulkSelected(current.professor_id ? [] : [turma.id]);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      setBulkError(err instanceof Error ? err.message : "Falha ao carregar turmas.");
    }).finally(() => { if (!controller.signal.aborted) setBulkLoading(false); });
    return () => controller.abort();
  }, [isOpen, escolaId, turma.id, bulkDisciplinaId, activeDisciplina?.disciplina?.id]);

  const filteredDisciplinas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return disciplinas;
    return disciplinas.filter((d) =>
      d.disciplina?.nome?.toLowerCase().includes(q) || d.professor?.nome?.toLowerCase().includes(q)
    );
  }, [disciplinas, search]);

  const toggleBulk = (disc: DisciplinaItem) => {
    if (savingId || bulkSaving) return;
    if (bulkDisciplinaId === disc.curso_matriz_id) {
      setBulkDisciplinaId(null);
      return;
    }
    setBulkDisciplinaId(disc.curso_matriz_id);
    setBulkError(null);
    setBulkSearch("");
    const current = selectedProfessorForLegacyId(disc.professor?.id, professores);
    setBulkProfessorUserId(current?.user_id ?? "");
  };

  const handleAssign = async (disc: DisciplinaItem, professor: ProfessorOption) => {
    // Single assignment keeps the original immediate-save behavior, but cannot replace.
    if (!professor.user_id || disc.professor?.id || savingId || bulkSaving) return;
    setSavingId(disc.curso_matriz_id);
    try {
      const res = await fetch(`/api/secretaria/turmas/${turma.id}/atribuir-professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curso_matriz_id: disc.curso_matriz_id,
          professor_user_id: professor.user_id,
          replace_existing: false,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atribuir professor.");
      await refreshDisciplinas();
      success("Atribuição guardada", "O professor foi associado à turma.");
      onUpdated?.();
    } catch (err) {
      toastError("Erro", err instanceof Error ? err.message : "Falha ao atribuir professor.");
      // Refresh after a stale write, rather than displaying a professor who was not saved.
      await refreshDisciplinas().catch(() => null);
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkAssign = async () => {
    if (!activeDisciplina || bulkSaving || bulkLoading) return;
    const selectedProfessor = professores.find((p) => p.user_id === bulkProfessorUserId);
    let itens: { turma_id: string; curso_matriz_id: string }[];
    try {
      itens = planTurmaModalBatch({
        turmaId: turma.id,
        cursoMatrizId: activeDisciplina.curso_matriz_id,
        assignedProfessorId: activeDisciplina.professor?.id ?? null,
        selectedProfessor,
        candidates: bulkCandidates,
        selectedTurmaIds: bulkSelected,
      });
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Seleção inválida.");
      return;
    }
    setBulkSaving(true);
    setBulkError(null);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/atribuicoes-em-massa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professor_user_id: selectedProfessor!.user_id,
          disciplina_id: activeDisciplina.disciplina.id,
          itens,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atribuir turmas.");
      await refreshDisciplinas();
      success("Atribuições guardadas", `${json.atribuicoes_criadas} turma(s) atribuída(s) numa única operação.`);
      setBulkDisciplinaId(null);
      setBulkCandidates([]);
      setBulkSelected([]);
      onUpdated?.();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Falha ao atribuir turmas.");
      await refreshDisciplinas().catch(() => null);
    } finally {
      setBulkSaving(false);
    }
  };

  if (!isOpen) return null;
  const atribuidas = disciplinas.filter((d) => Boolean(d.professor?.id)).length;
  const pending = disciplinas.length - atribuidas;
  const selectedBulkTeacher = professores.find((p) => p.user_id === bulkProfessorUserId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-0 sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="turma-assign-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{turma.turno || "Turno não definido"} · {turma.ano_letivo || "Ano letivo"}</p>
            <h2 id="turma-assign-title" className="mt-1 text-base font-bold text-[#1F6B3B]">
              Atribuir professores · {turma.nome || turma.turma_codigo}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {turma.curso_nome || "Ensino Geral"}{turma.classe_nome ? ` · ${turma.classe_nome}` : ""}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={bulkSaving || Boolean(savingId)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-slate-600"><strong>{disciplinas.length}</strong> disciplinas</span>
            <span className="flex items-center gap-1 font-medium text-[#1F6B3B]"><UserCheck size={13}/>{atribuidas} atribuídas</span>
            {pending > 0 && <span className="flex items-center gap-1 font-medium text-amber-700"><UserX size={13}/>{pending} sem professor</span>}
          </div>
          {disciplinas.length > 5 && <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar disciplina…" aria-label="Filtrar disciplina"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#E3B23C] sm:w-44" />}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-[#E3B23C]"/> A carregar disciplinas e professores…
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">
              <AlertCircle size={16} className="mb-2"/> {loadError}
              <button type="button" onClick={() => void loadData()} className="mt-3 block text-sm font-semibold underline">Tentar novamente</button>
            </div>
          ) : disciplinas.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen size={30} className="mx-auto mb-2 text-slate-300"/>
              <p className="text-sm font-medium">Nenhuma disciplina na matriz desta turma.</p>
            </div>
          ) : filteredDisciplinas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhuma disciplina corresponde à pesquisa.</p>
          ) : filteredDisciplinas.map((disc) => {
            const hasProf = Boolean(disc.professor?.id);
            const expanded = bulkDisciplinaId === disc.curso_matriz_id;
            const isSaving = savingId === disc.curso_matriz_id;
            const isPublished = !disc.curriculo_status || disc.curriculo_status === "published";
            const currentTeacher = selectedProfessorForLegacyId(disc.professor?.id, professores);
            const source = expanded ? bulkCandidates.find((item) => item.turma_id === turma.id) : null;
            const sourceAlreadyAssigned = Boolean(source?.professor_id);
            const selectedCandidates = expanded
              ? bulkCandidates.filter((item) => bulkSelected.includes(item.turma_id))
              : [];
            return (
              <section key={disc.curso_matriz_id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{disc.disciplina?.nome || "Disciplina"}</h3>
                      {disc.meta?.carga_horaria_semanal != null && <span className="text-xs text-slate-400">{disc.meta.carga_horaria_semanal} tempos/sem</span>}
                    </div>
                    <p className={`mt-1 flex items-center gap-1 text-xs ${hasProf ? "text-[#1F6B3B]" : "text-amber-700"}`}>
                      {hasProf ? <UserCheck size={13}/> : <UserX size={13}/>}
                      {hasProf ? disc.professor?.nome || "Professor atribuído" : "Sem professor"}
                    </p>
                  </div>
                  {!expanded && !hasProf && isPublished && (
                    <select aria-label={`Selecionar professor para ${disc.disciplina?.nome || "disciplina"}`}
                      value="" disabled={Boolean(savingId) || bulkSaving}
                      onChange={(e) => {
                        const prof = professores.find((item) => item.user_id === e.target.value);
                        if (prof) void handleAssign(disc, prof);
                      }}
                      className="min-w-[180px] max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20">
                      <option value="">Selecionar professor…</option>
                      {professores.map((prof) => <option key={prof.user_id} value={prof.user_id}>{prof.nome}</option>)}
                    </select>
                  )}
                  {isSaving && <Loader2 aria-label="A guardar" size={17} className="animate-spin text-[#E3B23C]"/>}
                </div>
                {!isPublished && <p className="mt-2 text-xs text-amber-700">Atribuição indisponível: a matriz desta disciplina ainda não está publicada.</p>}
                {hasProf && !expanded && (
                  <p className="mt-2 text-xs text-slate-500">Atribuição existente protegida. Não é possível substituí-la automaticamente.</p>
                )}

                {isPublished && (
                  <button type="button" disabled={Boolean(savingId) || bulkSaving || loading}
                    aria-expanded={expanded} onClick={() => toggleBulk(disc)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F6B3B] hover:underline disabled:opacity-50">
                    {expanded ? <ChevronDown size={15} className="rotate-180"/> : <Plus size={15}/>}
                    {expanded ? "Ocultar outras turmas" : "Atribuir também a outras turmas"}
                  </button>
                )}

                {expanded && (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-600">Professor</span>
                      <select value={bulkProfessorUserId} onChange={(e) => { setBulkProfessorUserId(e.target.value); setBulkError(null); }}
                        disabled={sourceAlreadyAssigned || bulkSaving || bulkLoading}
                        aria-label="Professor para atribuição múltipla"
                        className={inputClass}>
                        <option value="">Selecione o professor</option>
                        {professores.map((prof) => <option key={prof.user_id} value={prof.user_id}>{prof.nome}</option>)}
                      </select>
                    </label>
                    {sourceAlreadyAssigned && !currentTeacher && (
                      <p role="alert" className="text-xs text-amber-700">Não foi possível identificar o professor atual. Recarregue os dados antes de distribuir a disciplina.</p>
                    )}
                    {bulkLoading ? (
                      <div className="flex items-center gap-2 py-3 text-xs text-slate-500"><Loader2 size={15} className="animate-spin"/> A verificar turmas elegíveis…</div>
                    ) : bulkError && bulkCandidates.length === 0 ? (
                      <p role="alert" className="text-xs text-red-600">{bulkError}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">Turmas que oferecem esta disciplina</p>
                          <span className="text-xs text-slate-500">{bulkSelected.length} selecionada(s) · limite 30</span>
                        </div>
                        <input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)}
                          placeholder="Pesquisar turma…" aria-label="Pesquisar outras turmas"
                          className={inputClass}/>
                        <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                          {bulkCandidates.filter((item) => item.nome.toLowerCase().includes(bulkSearch.toLowerCase())).map((item) => {
                            const isSource = item.turma_id === turma.id;
                            const occupied = Boolean(item.professor_id);
                            const checked = isSource ? !occupied : bulkSelected.includes(item.turma_id);
                            return (
                              <label key={item.turma_id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-slate-50">
                                <span className="flex min-w-0 items-center gap-2">
                                  <input type="checkbox" className="accent-[#E3B23C]"
                                    checked={checked} disabled={isSource || occupied || bulkSaving}
                                    onChange={(e) => setBulkSelected((prev) => {
                                      if (e.target.checked && prev.length >= 30) return prev;
                                      return e.target.checked
                                        ? [...prev.filter((id) => id !== item.turma_id), item.turma_id]
                                        : prev.filter((id) => id !== item.turma_id);
                                    })}/>
                                  <span className="truncate font-medium text-slate-800">{item.nome}</span>
                                </span>
                                <span className="shrink-0 text-slate-500">
                                  {isSource ? (occupied ? "Atual · atribuída" : "Turma atual")
                                    : occupied ? "Já atribuída" : item.turno || "Disponível"}
                                </span>
                              </label>
                            );
                          })}
                          {bulkCandidates.length === 0 && <p className="p-3 text-xs text-slate-500">Nenhuma turma elegível.</p>}
                        </div>
                        <p className="text-xs text-slate-500">
                          {sourceAlreadyAssigned
                            ? "A turma atual mantém o professor; apenas as novas turmas selecionadas serão gravadas."
                            : "A turma atual está incluída. Todas as atribuições serão guardadas numa só transação."}
                        </p>
                      </>
                    )}
                    {bulkError && bulkCandidates.length > 0 && <p role="alert" className="text-xs text-red-600">{bulkError}</p>}
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" disabled={bulkSaving} onClick={() => setBulkDisciplinaId(null)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">Cancelar</button>
                      <button type="button" disabled={!selectedBulkTeacher || bulkLoading || bulkSaving || bulkSelected.length === 0 || Boolean(bulkError && bulkCandidates.length === 0)}
                        onClick={() => void handleBulkAssign()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
                        {bulkSaving ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>}
                        Atribuir a {selectedCandidates.length} turma(s)
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <p className="text-xs text-slate-500">Uma turma: guarda ao selecionar. Várias turmas: confirmar seleção.</p>
          <button type="button" onClick={onClose} disabled={Boolean(savingId) || bulkSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            Concluir
          </button>
        </footer>
      </div>
    </div>
  );
}
