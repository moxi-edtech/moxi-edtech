"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, UserCheck, UserX, BookOpen, AlertCircle, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
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
  disciplina: {
    id: string;
    nome: string;
  };
  meta?: {
    carga_horaria_semanal?: number | null;
  };
  professor?: {
    id: string | null;
    nome: string | null;
    email: string | null;
  } | null;
}

interface ProfessorOption {
  id?: string;
  teacher_id?: string;
  profile_id?: string;
  nome: string;
  email?: string;
}

export default function TurmaAtribuirProfessoresModal({
  turma,
  escolaId,
  isOpen,
  onClose,
  onUpdated,
}: TurmaAtribuirProfessoresModalProps) {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [professores, setProfessores] = useState<ProfessorOption[]>([]);
  const [selectedProfs, setSelectedProfs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!isOpen || !turma.id || !escolaId) return;
    setLoading(true);
    try {
      const [discRes, profRes] = await Promise.all([
        fetch(`/api/secretaria/turmas/${turma.id}/disciplinas?escola_id=${escolaId}`),
        fetch(`/api/secretaria/professores?escola_id=${escolaId}&pageSize=100&cargo=professor`),
      ]);

      const [discJson, profJson] = await Promise.all([
        discRes.json().catch(() => ({ ok: false, items: [] })),
        profRes.json().catch(() => ({ ok: false, items: [] })),
      ]);

      if (discJson.ok && Array.isArray(discJson.items)) {
        setDisciplinas(discJson.items);
        const map: Record<string, string> = {};
        discJson.items.forEach((d: DisciplinaItem) => {
          if (d.professor?.id) {
            map[d.curso_matriz_id] = d.professor.id;
          }
        });
        setSelectedProfs(map);
      }

      if (profJson.ok && Array.isArray(profJson.items)) {
        setProfessores(profJson.items);
      }
    } catch (err) {
      console.error("Erro ao carregar disciplinas/professores:", err);
      toastError("Erro", "Falha ao carregar disciplinas da turma.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, turma.id, escolaId, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (cursoMatrizId: string, profId: string) => {
    if (!profId || !turma.id) return;
    setSavingId(cursoMatrizId);
    try {
      const res = await fetch(`/api/secretaria/turmas/${turma.id}/atribuir-professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curso_matriz_id: cursoMatrizId,
          professor_id: profId,
          replace_existing: true,
        }),
      });

      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao atribuir professor");
      }

      success("Sucesso", "Professor atribuído com sucesso!");
      setSelectedProfs((prev) => ({ ...prev, [cursoMatrizId]: profId }));
      onUpdated?.();
    } catch (err) {
      toastError("Erro", err instanceof Error ? err.message : "Falha ao atribuir professor");
    } finally {
      setSavingId(null);
    }
  };

  const filteredDisciplinas = useMemo(() => {
    if (!search.trim()) return disciplinas;
    const q = search.toLowerCase();
    return disciplinas.filter((d) =>
      d.disciplina?.nome?.toLowerCase().includes(q) ||
      d.professor?.nome?.toLowerCase().includes(q)
    );
  }, [disciplinas, search]);

  if (!isOpen) return null;

  const totalDisciplinas = disciplinas.length;
  const atribuidas = disciplinas.filter((d) => Boolean(selectedProfs[d.curso_matriz_id])).length;
  const pendentes = totalDisciplinas - atribuidas;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                {turma.turno || "Turno não def."}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {turma.ano_letivo || "Ano letivo"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Atribuir Professores — {turma.nome || turma.turma_codigo}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {turma.curso_nome || "Ensino Geral"} {turma.classe_nome ? `· ${turma.classe_nome}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumo de Atribuições */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-600">
              Total: <strong>{totalDisciplinas}</strong> disciplinas
            </span>
            <span className="text-[#1F6B3B] font-medium flex items-center gap-1">
              <UserCheck size={13} /> {atribuidas} atribuídas
            </span>
            {pendentes > 0 && (
              <span className="text-klasse-gold-600 font-medium flex items-center gap-1">
                <UserX size={13} /> {pendentes} sem professor
              </span>
            )}
          </div>
          {totalDisciplinas > 5 && (
            <input
              type="text"
              placeholder="Filtrar disciplina…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#E3B23C] w-44"
            />
          )}
        </div>

        {/* Body / Lista de Disciplinas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#E3B23C]" />
              <p className="text-xs">Carregando matriz da turma…</p>
            </div>
          ) : disciplinas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium text-slate-700">Nenhuma disciplina cadastrada na matriz.</p>
              <p className="text-xs text-slate-400">Verifique a matriz curricular do curso/classe associado a esta turma.</p>
            </div>
          ) : (
            filteredDisciplinas.map((disc) => {
              const currentProfId = selectedProfs[disc.curso_matriz_id] || "";
              const isSaving = savingId === disc.curso_matriz_id;
              const hasProf = Boolean(currentProfId);

              return (
                <div
                  key={disc.id || disc.curso_matriz_id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    hasProf ? "bg-white border-slate-200" : "bg-klasse-gold-50/20 border-klasse-gold-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {disc.disciplina?.nome || "Disciplina"}
                      </h4>
                      {disc.meta?.carga_horaria_semanal && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {disc.meta.carga_horaria_semanal}h/sem
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      {hasProf ? (
                        <>
                          <UserCheck size={12} className="text-[#1F6B3B]" />
                          <span className="text-slate-700 font-medium">
                            {professores.find((p) => (p.id || p.teacher_id) === currentProfId)?.nome || disc.professor?.nome || "Professor atribuído"}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserX size={12} className="text-klasse-gold-600" />
                          <span className="text-klasse-gold-700 font-medium">Sem professor atribuído</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Selector & Action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={currentProfId}
                      onChange={(e) => {
                        const newProfId = e.target.value;
                        if (newProfId) {
                          handleAssign(disc.curso_matriz_id, newProfId);
                        }
                      }}
                      disabled={isSaving}
                      className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#E3B23C] min-w-[200px] cursor-pointer disabled:opacity-50"
                    >
                      <option value="">Selecione um professor…</option>
                      {professores.map((prof) => {
                        const pId = prof.id || prof.teacher_id || "";
                        return (
                          <option key={pId} value={pId}>
                            {prof.nome}
                          </option>
                        );
                      })}
                    </select>

                    {isSaving && <Loader2 size={15} className="animate-spin text-[#E3B23C]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            As alterações são salvas imediatamente ao selecionar o professor.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
