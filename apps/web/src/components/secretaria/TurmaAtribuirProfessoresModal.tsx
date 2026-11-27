"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, UserCheck, UserX, BookOpen, AlertCircle, Loader2, Check, Plus, ChevronDown } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { planTurmaModalBatch, selectedProfessorForLegacyId } from "@/lib/professores/turma-modal-assignment";
import type { AssignmentCandidate } from "@/lib/professores/assignment-candidates";

interface TurmaAtribuirProfessoresModalProps {
  turma: { id: string; nome?: string | null; turno?: string | null; ano_letivo?: number | string | null; curso_nome?: string | null; classe_nome?: string | null; turma_codigo?: string | null };
  initialDisciplinaId?: string | null;
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

const inputClass = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20 disabled:opacity-50";

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
  turma, escolaId, isOpen, onClose, onUpdated, initialDisciplinaId,
}: TurmaAtribuirProfessoresModalProps) {
  const { success, error: toastError } = useToast();
  const toastErrorRef = useRef(toastError);
  useEffect(() => { toastErrorRef.current = toastError; }, [toastError]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replaceDisciplinaId, setReplaceDisciplinaId] = useState<string | null>(null);
  const [replaceProfessorUserId, setReplaceProfessorUserId] = useState("");
  const [replaceReviewed, setReplaceReviewed] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
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
  const [classOpen, setClassOpen] = useState(false);
  const [classProfessor, setClassProfessor] = useState("");
  const [classScope, setClassScope] = useState<"all" | "some">("all");
  const [classSelected, setClassSelected] = useState<string[]>([]);
  const [classError, setClassError] = useState<string | null>(null);
  const [classReviewed, setClassReviewed] = useState(false);
  const classTeacher = professores.find((p) => p.user_id === classProfessor);
  const published = disciplinas.filter((d) => d.curriculo_status === "published");
  const classTargets = classScope === "all" ? published : published.filter((d) => classSelected.includes(d.curso_matriz_id));
  const classConflicts = classTargets.filter((d) => d.professor?.id && d.professor.id !== classTeacher?.professor_id).length;
  const classBusy = savingId === "class";

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
      const focused = items.find((d) => d.curso_matriz_id === initialDisciplinaId && d.professor?.id && d.curriculo_status === "published");
      if (focused) setReplaceDisciplinaId(focused.curso_matriz_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar professores e disciplinas.";
      setLoadError(message);
      toastErrorRef.current("Erro", message);
    } finally {
      setLoading(false);
    }
  }, [isOpen, turma.id, escolaId, refreshDisciplinas, initialDisciplinaId]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!isOpen) {
      setBulkDisciplinaId(null);
      setBulkCandidates([]);
      setBulkSelected([]);
      setBulkError(null);
      setReplaceDisciplinaId(null);
      setReplaceProfessorUserId("");
      setReplaceReviewed(false);
      setReplaceError(null);
      setClassOpen(false);
      setClassProfessor("");
      setClassScope("all");
      setClassSelected([]);
      setClassError(null);
      setClassReviewed(false);
    }
  }, [isOpen, turma.id, escolaId]);

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

  const handleClassAssign = async () => {
    if (!classTeacher?.professor_id || savingId || bulkSaving || loading) return;
    const selected = classTargets;
    if (classScope === "all" && (published.length !== disciplinas.length || published.length === 0)) return;
    if (classScope === "some" && (selected.length === 0 || selected.length !== classSelected.length)) return;
    if (classConflicts > 0 && !classReviewed) { setClassReviewed(true); return; }
    setSavingId("class");
    setClassError(null);
    try {
      const response = await fetch(`/api/escolas/${escolaId}/professores/docencia-turma`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turma.id,
          ...(classConflicts > 0 ? {
            regime: "trocar_disciplinas",
            professor_id: classTeacher.professor_id,
            scope: classScope,
            expected: selected.map((d) => ({ matriz_id: d.curso_matriz_id, professor_id: d.professor?.id ?? null })),
          } : {
            regime: classScope === "all" ? "monodocencia" : "misto",
            professor_id: classTeacher.professor_id,
            ...(classScope === "some" ? { matriz_ids: selected.map((d) => d.curso_matriz_id) } : {}),
          }),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Não foi possível atribuir o professor.");
      setClassOpen(false);
      setClassProfessor("");
      setClassSelected([]);
      setClassReviewed(false);
      success(classConflicts > 0 ? "Professor substituído" : "Professor atribuído", "As disciplinas seleccionadas foram guardadas. O histórico foi preservado.");
      await refreshDisciplinas().catch(() => {
        toastError("Actualizar disciplinas", "A atribuição foi guardada. Reabra a turma para ver os dados actualizados.");
      });
      onUpdated?.();
    } catch (err) {
      setClassReviewed(false);
      setClassError(err instanceof Error ? err.message : "Não foi possível atribuir o professor.");
      await refreshDisciplinas().catch(() => null);
    } finally {
      setSavingId(null);
    }
  };

  const toggleBulk = (disc: DisciplinaItem) => {
    if (savingId || bulkSaving) return;
    setClassOpen(false);
    if (bulkDisciplinaId === disc.curso_matriz_id) {
      setBulkDisciplinaId(null);
      return;
    }
    setReplaceDisciplinaId(null);
    setReplaceReviewed(false);
    setReplaceError(null);
    setBulkDisciplinaId(disc.curso_matriz_id);
    setBulkError(null);
    setBulkSearch("");
    const current = selectedProfessorForLegacyId(disc.professor?.id, professores);
    setBulkProfessorUserId(current?.user_id ?? "");
  };

  const toggleReplace = (disc: DisciplinaItem) => {
    if (savingId || bulkSaving) return;
    setClassOpen(false);
    if (replaceDisciplinaId === disc.curso_matriz_id) {
      setReplaceDisciplinaId(null);
    } else {
      setBulkDisciplinaId(null);
      setReplaceDisciplinaId(disc.curso_matriz_id);
    }
    setReplaceProfessorUserId("");
    setReplaceReviewed(false);
    setReplaceError(null);
  };

  const handleReplace = async (disc: DisciplinaItem) => {
    const previousId = disc.professor?.id;
    const next = professores.find((p) => p.user_id === replaceProfessorUserId);
    if (!replaceReviewed || !previousId || !next?.professor_id || previousId === next.professor_id
        || savingId || bulkSaving) return;
    setSavingId(disc.curso_matriz_id);
    setReplaceError(null);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/trocar-atribuicao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turma.id,
          curso_matriz_id: disc.curso_matriz_id,
          professor_anterior_id: previousId,
          professor_novo_user_id: next.user_id,
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.ok) throw new Error(result?.error || "Não foi possível trocar o professor.");
      await refreshDisciplinas().catch(() => { toastError("Actualizar disciplinas", "A troca foi guardada. Reabra a turma para ver os dados actualizados."); });
      setReplaceDisciplinaId(null);
      setReplaceReviewed(false);
      setReplaceProfessorUserId("");
      success("Professor substituído", "A atribuição académica foi actualizada. O histórico e os horários publicados foram preservados.");
      onUpdated?.();
    } catch (error) {
      setReplaceError(error instanceof Error ? error.message : "Falha ao trocar professor.");
      await refreshDisciplinas().catch(() => null);
      setReplaceReviewed(false);
    } finally {
      setSavingId(null);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="turma-assign-title"
        className="flex h-full w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-border sm:shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-muted px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{turma.turno || "Turno não definido"} · {turma.ano_letivo || "Ano letivo"}</p>
            <h2 id="turma-assign-title" className="mt-1 text-base font-bold text-klasse-green">
              Atribuir professores · {turma.nome || turma.turma_codigo}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {turma.curso_nome || "Ensino Geral"}{turma.classe_nome ? ` · ${turma.classe_nome}` : ""}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={bulkSaving || Boolean(savingId)}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3 text-xs sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-foreground"><strong>{disciplinas.length}</strong> disciplinas</span>
            <span className="flex items-center gap-1 font-medium text-klasse-green"><UserCheck size={13}/>{atribuidas} atribuídas</span>
            {pending > 0 && <span className="flex items-center gap-1 font-medium text-amber-700"><UserX size={13}/>{pending} sem professor</span>}
          </div>
          {disciplinas.length > 5 && <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar disciplina…" aria-label="Filtrar disciplina"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-klasse-gold sm:w-44" />}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {!loading && !loadError && published.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserCheck size={20} className="shrink-0 text-klasse-green"/>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Um professor para a turma</h3>
                    <p className="text-xs text-muted-foreground">Atribua ou troque o professor de várias disciplinas de uma só vez.</p>
                  </div>
                </div>
                <button type="button" aria-expanded={classOpen} disabled={Boolean(savingId) || bulkSaving}
                  onClick={() => {
                    setClassOpen(!classOpen);
                    setBulkDisciplinaId(null);
                    setReplaceDisciplinaId(null);
                    setClassError(null);
                    setClassReviewed(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-klasse-green disabled:opacity-50">
                  {classOpen ? "Cancelar" : <><Plus size={16}/> Gerir professor</>}
                </button>
              </div>
              {classOpen && (
                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  <label className="block space-y-1">
                    <span className="text-sm font-medium">Professor</span>
                    <select className={inputClass} value={classProfessor} disabled={Boolean(savingId) || bulkSaving}
                      onChange={(e) => { setClassProfessor(e.target.value); setClassSelected([]); setClassError(null); setClassReviewed(false); }}>
                      <option value="">Seleccionar professor</option>
                      {professores.filter((p) => p.professor_id).map((p) => <option key={p.user_id} value={p.user_id}>{p.nome}</option>)}
                    </select>
                  </label>
                  <fieldset disabled={Boolean(savingId) || bulkSaving} className="space-y-2">
                    <legend className="mb-1 text-sm font-medium">Disciplinas a atribuir</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`class-scope-${turma.id}`} checked={classScope === "all"}
                        onChange={() => { setClassScope("all"); setClassError(null); setClassReviewed(false); }} className="accent-klasse-gold"/>
                      Todas as disciplinas
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`class-scope-${turma.id}`} checked={classScope === "some"}
                        onChange={() => { setClassScope("some"); setClassError(null); setClassReviewed(false); }} className="accent-klasse-gold"/>
                      Escolher disciplinas
                    </label>
                    {classScope === "some" && classTeacher && (
                      <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                        {published.map((d) => {
                          const occupied = Boolean(d.professor?.id && d.professor.id !== classTeacher.professor_id);
                          return <label key={d.curso_matriz_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <input type="checkbox" className="accent-klasse-gold"
                              checked={classSelected.includes(d.curso_matriz_id)}
                              onChange={(e) => { setClassReviewed(false); setClassSelected((prev) => e.target.checked
                                ? [...prev.filter((id) => id !== d.curso_matriz_id), d.curso_matriz_id]
                                : prev.filter((id) => id !== d.curso_matriz_id)); }}/>
                            <span>{d.disciplina.nome}</span>
                            {occupied && <span className="ml-auto text-xs text-muted-foreground">{d.professor?.nome || "Já atribuída"}</span>}
                          </label>;
                        })}
                      </div>
                    )}
                  </fieldset>
                  {classTeacher && classScope === "all" && published.length !== disciplinas.length && (
                    <p role="status" className="text-xs text-amber-700">Existem disciplinas ainda não publicadas. Escolha as disciplinas disponíveis.</p>
                  )}
                  {classTeacher && classConflicts > 0 && (
                    <p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">
                      {classReviewed ? "Confirme a substituição de" : "Esta operação substituirá o professor de"} {classConflicts} disciplina(s) por <strong>{classTeacher.nome}</strong>. Notas, frequências e horários publicados serão preservados.
                    </p>
                  )}
                  {classError && <p role="alert" className="text-sm text-red-600">{classError}</p>}
                  <button type="button" onClick={() => void handleClassAssign()}
                    disabled={!classTeacher?.professor_id || Boolean(savingId) || bulkSaving ||
                      (classScope === "all" ? published.length !== disciplinas.length : classSelected.length === 0)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-klasse-gold px-4 py-2.5 text-sm font-semibold text-klasse-gold-900 disabled:opacity-50">
                    {classBusy ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                    {classConflicts > 0 ? (classReviewed ? "Confirmar troca" : "Rever troca") : classScope === "all" ? "Atribuir turma completa" : "Atribuir disciplinas"}
                  </button>
                </div>
              )}
            </section>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin text-klasse-gold"/> A carregar disciplinas e professores…
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">
              <AlertCircle size={16} className="mb-2"/> {loadError}
              <button type="button" onClick={() => void loadData()} className="mt-3 block text-sm font-semibold underline">Tentar novamente</button>
            </div>
          ) : disciplinas.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen size={30} className="mx-auto mb-2 text-muted-foreground"/>
              <p className="text-sm font-medium">Nenhuma disciplina na matriz desta turma.</p>
            </div>
          ) : filteredDisciplinas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma disciplina corresponde à pesquisa.</p>
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
              <section key={disc.curso_matriz_id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{disc.disciplina?.nome || "Disciplina"}</h3>
                      {disc.meta?.carga_horaria_semanal != null && <span className="text-xs text-muted-foreground">{disc.meta.carga_horaria_semanal} tempos/sem</span>}
                    </div>
                    <p className={`mt-1 flex items-center gap-1 text-xs ${hasProf ? "text-klasse-green" : "text-amber-700"}`}>
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
                      className="min-w-[180px] max-w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
                      <option value="">Selecionar professor…</option>
                      {professores.map((prof) => <option key={prof.user_id} value={prof.user_id}>{prof.nome}</option>)}
                    </select>
                  )}
                  {isSaving && <Loader2 aria-label="A guardar" size={17} className="animate-spin text-klasse-gold"/>}
                </div>
                {!isPublished && <p className="mt-2 text-xs text-amber-700">Atribuição indisponível: a matriz desta disciplina ainda não está publicada.</p>}
                {hasProf && isPublished && (
                  <button type="button" disabled={Boolean(savingId) || bulkSaving}
                    aria-expanded={replaceDisciplinaId === disc.curso_matriz_id}
                    onClick={() => toggleReplace(disc)}
                    className="mt-3 mr-4 inline-flex items-center gap-1.5 text-sm font-semibold text-klasse-green hover:underline disabled:opacity-50">
                    {replaceDisciplinaId === disc.curso_matriz_id ? "Cancelar troca" : "Trocar professor"}
                  </button>
                )}
                {replaceDisciplinaId === disc.curso_matriz_id && hasProf && isPublished && (
                  <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted p-3">
                    <p className="text-sm font-semibold text-foreground">Substituir professor · {disc.disciplina?.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Atual: <strong>{disc.professor?.nome || "Professor atribuído"}</strong>
                    </p>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-foreground">Novo professor</span>
                      <select aria-label="Novo professor" value={replaceProfessorUserId}
                        disabled={Boolean(savingId)}
                        onChange={(e) => {
                          setReplaceProfessorUserId(e.target.value);
                          setReplaceReviewed(false);
                          setReplaceError(null);
                        }}
                        className={inputClass}>
                        <option value="">Selecione o professor</option>
                        {professores.filter((prof) => prof.professor_id && prof.professor_id !== disc.professor?.id)
                          .map((prof) => <option key={prof.user_id} value={prof.user_id}>{prof.nome}</option>)}
                      </select>
                    </label>
                    {replaceError && <p role="alert" className="text-xs text-red-600">{replaceError}</p>}
                    {replaceReviewed && replaceProfessorUserId && (
                      <p role="status" className="rounded-xl border border-border bg-card p-3 text-xs text-foreground">
                        Confirmar a troca de <strong>{disc.professor?.nome || "professor atual"}</strong> por{" "}
                        <strong>{professores.find((prof) => prof.user_id === replaceProfessorUserId)?.nome || "novo professor"}</strong>
                        {" "}nesta disciplina? As notas e frequências não serão alteradas.
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => toggleReplace(disc)} disabled={Boolean(savingId)}
                        className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">Cancelar</button>
                      <button type="button"
                        disabled={!replaceProfessorUserId || Boolean(savingId)}
                        onClick={() => replaceReviewed ? void handleReplace(disc) : setReplaceReviewed(true)}
                        className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-klasse-gold-900 disabled:opacity-50">
                        {savingId ? "A guardar…" : replaceReviewed ? "Confirmar troca" : "Rever troca"}
                      </button>
                    </div>
                  </div>
                )}

                {isPublished && (
                  <button type="button" disabled={Boolean(savingId) || bulkSaving || loading}
                    aria-expanded={expanded} onClick={() => toggleBulk(disc)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-klasse-green hover:underline disabled:opacity-50">
                    {expanded ? <ChevronDown size={15} className="rotate-180"/> : <Plus size={15}/>}
                    {expanded ? "Ocultar outras turmas" : "Atribuir também a outras turmas"}
                  </button>
                )}

                {expanded && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-foreground">Professor</span>
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
                      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 size={15} className="animate-spin"/> A verificar turmas elegíveis…</div>
                    ) : bulkError && bulkCandidates.length === 0 ? (
                      <p role="alert" className="text-xs text-red-600">{bulkError}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">Turmas que oferecem esta disciplina</p>
                          <span className="text-xs text-muted-foreground">{bulkSelected.length} selecionada(s) · limite 30</span>
                        </div>
                        <input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)}
                          placeholder="Pesquisar turma…" aria-label="Pesquisar outras turmas"
                          className={inputClass}/>
                        <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                          {bulkCandidates.filter((item) => item.nome.toLowerCase().includes(bulkSearch.toLowerCase())).map((item) => {
                            const isSource = item.turma_id === turma.id;
                            const occupied = Boolean(item.professor_id);
                            const checked = isSource ? !occupied : bulkSelected.includes(item.turma_id);
                            return (
                              <label key={item.turma_id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-muted">
                                <span className="flex min-w-0 items-center gap-2">
                                  <input type="checkbox" className="accent-klasse-gold"
                                    checked={checked} disabled={isSource || occupied || bulkSaving}
                                    onChange={(e) => setBulkSelected((prev) => {
                                      if (e.target.checked && prev.length >= 30) return prev;
                                      return e.target.checked
                                        ? [...prev.filter((id) => id !== item.turma_id), item.turma_id]
                                        : prev.filter((id) => id !== item.turma_id);
                                    })}/>
                                  <span className="truncate font-medium text-foreground">{item.nome}</span>
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                  {isSource ? (occupied ? "Atual · atribuída" : "Turma atual")
                                    : occupied ? "Já atribuída" : item.turno || "Disponível"}
                                </span>
                              </label>
                            );
                          })}
                          {bulkCandidates.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhuma turma elegível.</p>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {sourceAlreadyAssigned
                            ? "A turma atual mantém o professor; apenas as novas turmas selecionadas serão gravadas."
                            : "A turma atual está incluída. Todas as atribuições serão guardadas numa só transação."}
                        </p>
                      </>
                    )}
                    {bulkError && bulkCandidates.length > 0 && <p role="alert" className="text-xs text-red-600">{bulkError}</p>}
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" disabled={bulkSaving} onClick={() => setBulkDisciplinaId(null)}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-foreground">Cancelar</button>
                      <button type="button" disabled={!selectedBulkTeacher || bulkLoading || bulkSaving || bulkSelected.length === 0 || Boolean(bulkError && bulkCandidates.length === 0)}
                        onClick={() => void handleBulkAssign()}
                        className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-klasse-gold-900 hover:brightness-95 disabled:opacity-50">
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

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-muted px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Uma turma: guarda ao selecionar. Várias turmas: confirmar seleção.</p>
          <button type="button" onClick={onClose} disabled={Boolean(savingId) || bulkSaving}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">
            Concluir
          </button>
        </footer>
      </div>
    </div>
  );
}
