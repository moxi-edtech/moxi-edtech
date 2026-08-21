"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X,
  Calendar,
  Clock,
  Save,
  Wand2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Printer,
  Sparkles,
  BookOpen,
  UserCheck,
  UserX,
  Info
} from "lucide-react";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { downloadHorarioTurmaPdf } from "@/lib/horarios/downloadHorarioTurmaPdf";
import type { TurmaItem } from "~/types/turmas";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface TurmaHorarioModalProps {
  turma: TurmaItem;
  escolaId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

interface SlotItem {
  id: string;
  ordem: number;
  dia_semana: number;
  inicio: string;
  fim: string;
  is_intervalo?: boolean;
}

interface DisciplinaCarga {
  id: string; // curso_matriz_id
  disciplinaId: string;
  nome: string;
  sigla: string;
  cargaSemanal: number;
  alocados: number;
  professorId?: string | null;
  professorNome?: string | null;
  cor: string;
}

const PALETA_CORES = [
  "bg-blue-50 text-blue-800 border-blue-200",
  "bg-emerald-50 text-emerald-800 border-emerald-200",
  "bg-purple-50 text-purple-800 border-purple-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-rose-50 text-rose-800 border-rose-200",
  "bg-cyan-50 text-cyan-800 border-cyan-200",
  "bg-indigo-50 text-indigo-800 border-indigo-200",
  "bg-teal-50 text-teal-800 border-teal-200",
  "bg-orange-50 text-orange-800 border-orange-200",
  "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
];

export default function TurmaHorarioModal({
  turma,
  escolaId,
  isOpen,
  onClose,
  onUpdated,
}: TurmaHorarioModalProps) {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const toastErrorRef = useRef(toastError);

  useEffect(() => {
    toastErrorRef.current = toastError;
  }, [toastError]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaCarga[]>([]);
  const [grid, setGrid] = useState<Record<string, string | null>>({}); // key: `${dia}-${ordem}` -> curso_matriz_id
  const [slotLookup, setSlotLookup] = useState<Record<string, string>>({}); // key: `${dia}-${ordem}` -> slot_id
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<string | null>(null);

  // Carrega dados iniciais da turma e slots da escola
  const loadData = useCallback(async () => {
    if (!isOpen || !turma.id || !escolaId) return;
    setLoading(true);

    try {
      // 1. Slots, 2. Disciplinas da turma, 3. Quadro publicado/atual
      const [slotsRes, discRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/horarios/slots`, { cache: "no-store" }),
        fetch(`/api/secretaria/turmas/${turma.id}/disciplinas?escola_id=${escolaId}`, { cache: "no-store" }),
      ]);

      const [slotsJson, discJson] = await Promise.all([
        slotsRes.json().catch(() => ({ ok: false, items: [] })),
        discRes.json().catch(() => ({ ok: false, items: [] })),
      ]);

      const rawSlots: SlotItem[] = slotsJson.ok && Array.isArray(slotsJson.items) ? slotsJson.items : [];
      setSlots(rawSlots);

      const lookup: Record<string, string> = {};
      for (const slot of rawSlots) {
        if (slot.dia_semana >= 1 && slot.dia_semana <= 5) {
          const diaNome = DIAS_SEMANA[slot.dia_semana - 1];
          lookup[`${diaNome}-${slot.ordem}`] = slot.id;
        }
      }
      setSlotLookup(lookup);

      // Mapear disciplinas da turma
      const rawDisc: any[] = discJson.ok && Array.isArray(discJson.items) ? discJson.items : [];
      const discList: DisciplinaCarga[] = rawDisc.map((d, index) => {
        const nome = d.disciplina?.nome || "Sem Nome";
        const sigla = nome
          .split(" ")
          .filter(Boolean)
          .map((w: string) => w[0])
          .slice(0, 3)
          .join("")
          .toUpperCase();

        return {
          id: d.curso_matriz_id || d.id,
          disciplinaId: d.disciplina?.id || d.id,
          nome,
          sigla: sigla || "DISC",
          cargaSemanal: Number(d.meta?.carga_horaria_semanal ?? 0),
          alocados: 0,
          professorId: d.professor?.id || null,
          professorNome: d.professor?.nome || null,
          cor: PALETA_CORES[index % PALETA_CORES.length],
        };
      });

      // 4. Buscar quadro atual se houver
      const quadroRes = await fetch(
        `/api/escolas/${escolaId}/horarios/quadro?turma_id=${turma.id}&ano_letivo_id=${turma.session_id || turma.ano_letivo_id || ""}`,
        { cache: "no-store" }
      ).catch(() => null);

      const nextGrid: Record<string, string | null> = {};
      if (quadroRes && quadroRes.ok) {
        const quadroJson = await quadroRes.json().catch(() => ({ ok: false, items: [] }));
        if (quadroJson.ok && Array.isArray(quadroJson.items)) {
          const slotIdToKey = new Map(Object.entries(lookup).map(([k, id]) => [id, k]));
          for (const item of quadroJson.items) {
            const slotKey = slotIdToKey.get(item.slot_id);
            if (slotKey) {
              // Encontrar disciplina correspondente
              const match = discList.find(
                (dc) => dc.id === item.disciplina_id || dc.disciplinaId === item.disciplina_id
              );
              if (match) {
                nextGrid[slotKey] = match.id;
              }
            }
          }
        }
      }

      // Atualizar contagens de alocação
      const alocadosCount: Record<string, number> = {};
      for (const discId of Object.values(nextGrid)) {
        if (discId) {
          alocadosCount[discId] = (alocadosCount[discId] || 0) + 1;
        }
      }

      setDisciplinas(
        discList.map((d) => ({
          ...d,
          alocados: alocadosCount[d.id] || 0,
        }))
      );
      setGrid(nextGrid);
    } catch (err) {
      console.error("Erro ao carregar dados do horário:", err);
      toastErrorRef.current("Erro", "Falha ao carregar dados do horário.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, turma.id, turma.session_id, turma.ano_letivo_id, escolaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalcula contagem de alocados sempre que o grid mudar
  const estoqueDisciplinas = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const val of Object.values(grid)) {
      if (val) counts[val] = (counts[val] || 0) + 1;
    }
    return disciplinas.map((d) => ({
      ...d,
      alocados: counts[d.id] || 0,
    }));
  }, [disciplinas, grid]);

  const ordensUnicas = useMemo(() => {
    const map = new Map<number, SlotItem>();
    for (const s of slots) {
      if (!map.has(s.ordem)) {
        map.set(s.ordem, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ordem - b.ordem);
  }, [slots]);

  // Clique em uma célula da grade
  const handleCellClick = (dia: string, ordem: number) => {
    const key = `${dia}-${ordem}`;
    const atual = grid[key];

    // Se tiver uma disciplina selecionada no painel, atribui
    if (selectedDisciplinaId) {
      const disc = estoqueDisciplinas.find((d) => d.id === selectedDisciplinaId);
      if (disc && disc.alocados >= disc.cargaSemanal && atual !== selectedDisciplinaId) {
        toastError("Limite atingido", `${disc.nome} já atingiu a carga semanal de ${disc.cargaSemanal} tempos.`);
        return;
      }
      setGrid((prev) => ({ ...prev, [key]: selectedDisciplinaId }));
      return;
    }

    // Se clicar numa célula ocupada sem disciplina selecionada, limpa o slot
    if (atual) {
      setGrid((prev) => ({ ...prev, [key]: null }));
    }
  };

  // Limpar grade completa
  const handleClearGrid = async () => {
    const ok = await confirm({
      title: "Limpar Grade",
      message: "Tem certeza que deseja remover todas as aulas alocadas nesta turma?",
      confirmLabel: "Limpar",
      variant: "danger",
    });
    if (ok) {
      setGrid({});
    }
  };

  // Auto-completar inteligente
  const handleAutoComplete = async () => {
    setAutoScheduling(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turma.id,
          strategy: "v1",
          dry_run: true,
        }),
      });

      const json = await res.json();
      if (json.ok && Array.isArray(json.assignments)) {
        const slotIdToKey = new Map(Object.entries(slotLookup).map(([k, id]) => [id, k]));
        const nextGrid = { ...grid };

        for (const assign of json.assignments) {
          const key = slotIdToKey.get(assign.slot_id);
          if (key) {
            const disc = disciplinas.find(
              (d) => d.id === assign.disciplina_id || d.disciplinaId === assign.disciplina_id
            );
            if (disc) {
              nextGrid[key] = disc.id;
            }
          }
        }
        setGrid(nextGrid);
        success("Auto-preenchimento", "Aulas distribuídas com sucesso na grade!");
      } else {
        throw new Error(json.error || "Não foi possível auto-preencher a grade.");
      }
    } catch (err) {
      toastError("Auto-preenchimento", err instanceof Error ? err.message : "Não foi possível auto-preencher a grade.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const distribuirLocalmente = () => {
    const nextGrid: Record<string, string | null> = { ...grid };
    const slotsDisponiveis: string[] = [];

    for (const dia of DIAS_SEMANA) {
      for (const o of ordensUnicas) {
        const key = `${dia}-${o.ordem}`;
        if (!o.is_intervalo && !nextGrid[key]) {
          slotsDisponiveis.push(key);
        }
      }
    }

    let slotIndex = 0;
    for (const disc of estoqueDisciplinas) {
      const faltam = Math.max(0, disc.cargaSemanal - disc.alocados);
      for (let i = 0; i < faltam; i++) {
        if (slotIndex < slotsDisponiveis.length) {
          nextGrid[slotsDisponiveis[slotIndex]] = disc.id;
          slotIndex++;
        }
      }
    }

    setGrid(nextGrid);
    success("Auto-distribuição", "Aulas alocadas automaticamente nos tempos disponíveis.");
  };

  // Salvar / Publicar grade
  const handleSave = async (mode: "draft" | "publish" = "publish") => {
    const anoLetivoId = turma.session_id || turma.ano_letivo_id;
    if (!anoLetivoId) {
      toastError("Erro", "Ano letivo da turma não identificado.");
      return;
    }

    setSaving(true);
    try {
      const items: Array<{
        slot_id: string;
        disciplina_id: string;
        professor_id?: string | null;
      }> = [];

      for (const [key, discId] of Object.entries(grid)) {
        if (!discId) continue;
        const slotId = slotLookup[key];
        if (!slotId) continue;

        const disc = disciplinas.find((d) => d.id === discId);
        items.push({
          slot_id: slotId,
          disciplina_id: disc?.disciplinaId || discId,
          professor_id: disc?.professorId || null,
        });
      }

      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ano_letivo_id: anoLetivoId,
          turma_id: turma.id,
          items,
          mode,
        }),
      });

      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao salvar horário da turma");
      }

      success(
        mode === "publish" ? "Horário Publicado!" : "Rascunho Salvo!",
        "A grade de horários da turma foi atualizada com sucesso."
      );
      onUpdated?.();
      onClose();
    } catch (err) {
      toastError("Erro", err instanceof Error ? err.message : "Falha ao salvar horário.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadHorarioTurmaPdf({ turma: { id: turma.id }, escolaId });
    } catch (err) {
      toastError("PDF", err instanceof Error ? err.message : "Não foi possível gerar o PDF.");
    }
  };

  if (!isOpen) return null;

  const totalTemposSemanais = ordensUnicas.filter((s) => !s.is_intervalo).length * 5;
  const totalAlocados = Object.values(grid).filter(Boolean).length;
  const totalCargaNecessaria = disciplinas.reduce((acc, d) => acc + d.cargaSemanal, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                {turma.turno || "Turno não def."}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {turma.ano_letivo || "Ano letivo"}
              </span>
              {turma.sala && (
                <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  Sala: {turma.sala}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Calendar size={18} className="text-[#1F6B3B]" /> Grade de Horários — {turma.nome || turma.turma_codigo}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {turma.curso_nome || "Ensino Geral"} {turma.classe_nome ? `· ${turma.classe_nome}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleDownloadPdf()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
              title="Baixar ou imprimir horário em PDF"
            >
              <Printer size={14} /> PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Status & Ações Rápidas */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Alocação:</span>
              <span className="font-bold text-slate-800">
                {totalAlocados}/{totalCargaNecessaria} tempos
              </span>
              {totalAlocados >= totalCargaNecessaria ? (
                <span className="inline-flex items-center text-[10px] font-bold text-[#1F6B3B] bg-emerald-50 px-1.5 py-0.5 rounded">
                  <CheckCircle2 size={11} className="mr-0.5" /> Completa
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Faltam {totalCargaNecessaria - totalAlocados}
                </span>
              )}
            </div>
            <span className="text-slate-200">|</span>
            <span className="text-slate-400">
              {selectedDisciplinaId ? (
                <span className="text-slate-700 font-medium">
                  Modo preenchimento ativo: clique nas células para alocar
                </span>
              ) : (
                "Selecione uma disciplina ao lado para alocar rápido"
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoComplete}
              disabled={autoScheduling || loading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1F6B3B] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {autoScheduling ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Auto-preencher
            </button>
            {totalAlocados > 0 && (
              <button
                onClick={handleClearGrid}
                className="flex items-center gap-1 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Limpar todas as alocações da grade"
              >
                <Trash2 size={13} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Corpo Principal (Grade + Sidebar) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Lado Esquerdo: Grade Semanal */}
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/40">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-[#E3B23C]" />
                <p className="text-xs">Carregando estrutura de horários…</p>
              </div>
            ) : ordensUnicas.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2 bg-white rounded-xl border border-slate-200 p-8">
                <Clock className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Nenhum tempo/slot configurado para a escola.</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Configure os horários de início e fim dos tempos no menu de Configurações de Horários da escola.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full border-collapse table-fixed text-center">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-20 p-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-100">
                        Tempo
                      </th>
                      {DIAS_SEMANA.map((dia) => (
                        <th key={dia} className="p-2.5 text-xs font-bold text-slate-700 border-r border-slate-100 last:border-r-0">
                          {dia}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ordensUnicas.map((slot) => {
                      if (slot.is_intervalo) {
                        return (
                          <tr key={`intervalo-${slot.ordem}`} className="bg-slate-100/60">
                            <td className="p-2 text-[10px] font-mono text-slate-400 border-r border-slate-200">
                              {slot.inicio} - {slot.fim}
                            </td>
                            <td colSpan={5} className="p-2 text-center text-xs font-semibold text-slate-400 tracking-wider">
                              — INTERVALO / RECREIO —
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={slot.ordem} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2.5 text-left border-r border-slate-100 bg-slate-50/30">
                            <div className="font-bold text-xs text-slate-700">{slot.ordem}º Tempo</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {slot.inicio} - {slot.fim}
                            </div>
                          </td>

                          {DIAS_SEMANA.map((dia) => {
                            const key = `${dia}-${slot.ordem}`;
                            const assignedDiscId = grid[key];
                            const disc = assignedDiscId
                              ? estoqueDisciplinas.find((d) => d.id === assignedDiscId)
                              : null;

                            return (
                              <td
                                key={key}
                                onClick={() => handleCellClick(dia, slot.ordem)}
                                className={`p-1.5 border-r border-slate-100 last:border-r-0 h-16 align-middle cursor-pointer transition-all ${
                                  disc
                                    ? "hover:opacity-90"
                                    : selectedDisciplinaId
                                    ? "hover:bg-amber-50/60 bg-white"
                                    : "hover:bg-slate-100/60 bg-slate-50/20"
                                }`}
                              >
                                {disc ? (
                                  <div
                                    className={`w-full h-full rounded-lg border p-1 flex flex-col justify-between text-left transition-all ${disc.cor} shadow-2xs`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs truncate leading-tight">
                                        {disc.sigla}
                                      </span>
                                      <span className="text-[9px] opacity-70 font-mono">
                                        {slot.ordem}º
                                      </span>
                                    </div>
                                    <p className="text-[10px] truncate opacity-90 leading-tight">
                                      {disc.professorNome || disc.nome}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="w-full h-full rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-[11px] hover:border-slate-400 hover:text-slate-500 transition-colors">
                                    +
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lado Direito: Painel de Disciplinas & Cargas */}
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-4 flex flex-col">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Disciplinas da Turma
              </h3>
              <p className="text-[11px] text-slate-500">
                Clique numa matéria para selecionar e preencher na grade.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {disciplinas.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma disciplina na matriz da turma.
                </div>
              ) : (
                estoqueDisciplinas.map((disc) => {
                  const isSelected = selectedDisciplinaId === disc.id;
                  const isComplete = disc.alocados >= disc.cargaSemanal;

                  return (
                    <div
                      key={disc.id}
                      onClick={() => setSelectedDisciplinaId(isSelected ? null : disc.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-[#E3B23C] border-[#E3B23C] bg-amber-50/40"
                          : isComplete
                          ? "bg-slate-50/60 border-slate-200 opacity-70 hover:opacity-100"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />
                            <span className="font-bold text-xs text-slate-800 truncate">
                              {disc.nome}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            {disc.professorNome ? (
                              <>
                                <UserCheck size={11} className="text-[#1F6B3B]" />
                                <span className="truncate">{disc.professorNome}</span>
                              </>
                            ) : (
                              <>
                                <UserX size={11} className="text-amber-600" />
                                <span className="text-amber-600 font-medium">Sem prof.</span>
                              </>
                            )}
                          </p>
                        </div>

                        {/* Contador de Aulas */}
                        <div className="text-right flex-shrink-0">
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              isComplete
                                ? "bg-emerald-50 text-[#1F6B3B]"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {disc.alocados}/{disc.cargaSemanal}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedDisciplinaId && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between animate-in fade-in">
                <span>Modo de seleção ativo</span>
                <button
                  onClick={() => setSelectedDisciplinaId(null)}
                  className="font-bold text-amber-700 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info size={13} />
            <span>Clique num tempo vazio para alocar a matéria selecionada; clique num tempo ocupado para desocupar.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => handleSave("draft")}
              disabled={saving || loading}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Guardar rascunho
            </button>
            <button
              onClick={() => handleSave("publish")}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1F6B3B] hover:brightness-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Publicar Horário
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
