"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Plus,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileEdit,
  Send,
  HelpCircle,
  ChevronRight,
  Trash2,
  Award,
  Layers,
  Bot
} from "lucide-react";

type Question = {
  ordem: number;
  tipo: "escolha_unica" | "verdadeiro_falso" | "resposta_curta";
  enunciado: string;
  opcoes: string[];
  resposta_correta?: any;
  pontos: number;
};

type ActivityItem = {
  id: string;
  titulo: string;
  instrucoes?: string | null;
  tipo: "quiz" | "exercicio" | "tarefa" | "simulado";
  turma_id: string;
  disciplina_id: string;
  status: "rascunho" | "publicada" | "encerrada";
  prazo?: string | null;
  tentativas_permitidas: number;
  nota_maxima: number;
  published_at?: string | null;
  created_at: string;
  atividade_questoes?: Question[];
};

type Assignment = {
  turma_id: string;
  disciplina_id: string;
  turma_nome?: string;
  disciplina_nome?: string;
};

export default function ProfessorAtividadesPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const escolaParam = getEscolaParamFromPath(pathname);
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  const { success, error: toastError } = useToast();
  const [atividades, setAtividades] = useState<ActivityItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Modal State for New Activity
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextActionError, setNextActionError] = useState<{
    error: string;
    next_action?: { type: string; label: string; href: string };
  } | null>(null);

  // Form State
  const [form, setForm] = useState<{
    titulo: string;
    instrucoes: string;
    tipo: "quiz" | "exercicio" | "tarefa" | "simulado";
    turma_id: string;
    disciplina_id: string;
    prazo: string;
    tentativas_permitidas: number;
    nota_maxima: number;
    publicar: boolean;
  }>({
    titulo: "",
    instrucoes: "",
    tipo: "quiz",
    turma_id: "",
    disciplina_id: "",
    prazo: "",
    tentativas_permitidas: 1,
    nota_maxima: 20,
    publicar: false,
  });

  // Questions Builder State
  const [questoes, setQuestoes] = useState<Question[]>([
    {
      ordem: 1,
      tipo: "escolha_unica",
      enunciado: "",
      opcoes: ["Opção A", "Opção B"],
      pontos: 5,
    },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [actRes, agendaRes] = await Promise.all([
        fetch("/api/professor/atividades", { cache: "no-store" }),
        fetch("/api/professor/agenda", { cache: "no-store" }),
      ]);

      const actJson = await actRes.json();
      const agendaJson = await agendaRes.json();

      if (actRes.ok && actJson.ok) {
        setAtividades(actJson.items || []);
      }

      if (agendaRes.ok && agendaJson.items) {
        // Map unique turma/disciplina pairs
        const pairsMap = new Map<string, Assignment>();
        for (const item of agendaJson.items) {
          if (item.turma_id && item.disciplina_id) {
            const key = `${item.turma_id}:${item.disciplina_id}`;
            if (!pairsMap.has(key)) {
              pairsMap.set(key, {
                turma_id: item.turma_id,
                disciplina_id: item.disciplina_id,
                turma_nome: item.turma_nome || "Turma",
                disciplina_nome: item.disciplina_nome || "Disciplina",
              });
            }
          }
        }
        setAssignments(Array.from(pairsMap.values()));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const editId = searchParams?.get("edit");
    if (!editId) return;
    let active = true;
    (async () => {
      const res = await fetch(`/api/professor/atividades/${editId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!active || !res.ok || !json?.ok || !json.activity) return;
      const item = json.activity;
      setEditingId(editId);
      setForm({
        titulo: item.titulo,
        instrucoes: item.instrucoes ?? "",
        tipo: item.tipo,
        turma_id: item.turma_id,
        disciplina_id: item.disciplina_id,
        prazo: item.prazo ? new Date(item.prazo).toISOString().slice(0, 16) : "",
        tentativas_permitidas: item.tentativas_permitidas,
        nota_maxima: Number(item.nota_maxima),
        publicar: false,
      });
      setQuestoes((item.atividade_questoes ?? []).map((q: Question) => ({ ...q, opcoes: q.opcoes ?? [] })));
      setShowModal(true);
    })();
    return () => { active = false; };
  }, [searchParams]);

  // Filter activities
  const filteredAtividades = useMemo(() => {
    return atividades.filter((act) => {
      if (filterStatus === "todos") return true;
      return act.status === filterStatus;
    });
  }, [atividades, filterStatus]);

  // Handle Question Changes
  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestoes((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  };

  const addQuestion = () => {
    setQuestoes((prev) => [
      ...prev,
      {
        ordem: prev.length + 1,
        tipo: "escolha_unica",
        enunciado: "",
        opcoes: ["Opção A", "Opção B"],
        pontos: 5,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questoes.length <= 1) return;
    setQuestoes((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((q, idx) => ({ ...q, ordem: idx + 1 }))
    );
  };

  // Submit Activity (Save Draft or Publish)
  const handleSubmit = async (publicarDirecto: boolean) => {
    setSaving(true);
    setNextActionError(null);
    try {
      if (!form.turma_id || !form.disciplina_id) {
        throw new Error("Selecione a turma e disciplina");
      }
      if (!form.titulo.trim()) {
        throw new Error("Digite o título da actividade");
      }

      const payload = {
        titulo: form.titulo,
        instrucoes: form.instrucoes || null,
        tipo: form.tipo,
        turma_id: form.turma_id,
        disciplina_id: form.disciplina_id,
        prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
        tentativas_permitidas: form.tentativas_permitidas,
        nota_maxima: form.nota_maxima,
        source_material_ids: [],
        questoes: questoes.map((q, i) => ({
          ordem: i + 1,
          tipo: q.tipo,
          enunciado: q.enunciado || `Questão ${i + 1}`,
          opcoes: q.tipo === "escolha_unica" ? q.opcoes : [],
          resposta_correta: q.resposta_correta ?? null,
          pontos: q.pontos || 1,
        })),
        publicar: publicarDirecto,
      };

      const res = await fetch(editingId ? `/api/professor/atividades/${editingId}` : "/api/professor/atividades", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, status: publicarDirecto ? "publicada" : "rascunho" } : payload),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.next_action) {
          setNextActionError({
            error: json.error || "Ação necessária",
            next_action: json.next_action,
          });
          return;
        }
        throw new Error(json.error || "Erro ao guardar actividade");
      }

      success(
        publicarDirecto ? "Actividade Publicada!" : "Rascunho Guardado",
        publicarDirecto
          ? "A actividade já está visível para os alunos da turma."
          : "Poderá retomar e editar este rascunho a qualquer momento."
      );

      setShowModal(false);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      toastError("Erro ao Salvar", err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  // Toggle status of existing activity
  const togglePublishStatus = async (activityId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "publicada" ? "rascunho" : "publicada";
      const res = await fetch(`/api/professor/atividades/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.next_action) {
          toastError("Não é possível publicar", json.error);
          return;
        }
        throw new Error(json.error || "Erro ao alterar estado");
      }

      success("Estado Atualizado", `Actividade alterada para ${newStatus}.`);
      loadData();
    } catch (err: any) {
      toastError("Erro", err.message || String(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* HEADER DA PÁGINA */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <DashboardHeader
            title="Aprendizagem Contínua & Actividades"
            description="Crie quizzes, exercícios, tarefas e simulados para acompanhamento contínuo dos alunos."
            breadcrumbs={[
              { label: "Início", href: "/professor" },
              { label: "Pedagógico", href: "/professor" },
              { label: "Actividades" },
            ]}
          />
          <button
            type="button"
            onClick={() => {
              setNextActionError(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-500 active:scale-95 transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Nova Actividade</span>
          </button>
        </header>

        {/* FILTROS DE ESTADO */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1">
            {[
              { id: "todos", label: "Todas as Actividades" },
              { id: "rascunho", label: "Rascunhos" },
              { id: "publicada", label: "Publicadas" },
              { id: "encerrada", label: "Encerradas" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === tab.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-bold text-slate-400 px-3">
            Total: <span className="text-slate-900 font-black">{filteredAtividades.length}</span>
          </div>
        </div>

        {/* LISTA DE ACTIVIDADES */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : filteredAtividades.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Nenhuma actividade encontrada</h3>
            <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
              Crie a sua primeira actividade pedagógica (quiz, exercício ou tarefa) para envolver os alunos fora da sala de aula.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Rascunho</span>
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAtividades.map((act) => {
              const numQuestoes = act.atividade_questoes?.length ?? 0;
              const isRascunho = act.status === "rascunho";
              const isPublicada = act.status === "publicada";

              let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
              if (isPublicada) badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
              if (isRascunho) badgeStyle = "bg-amber-50 text-amber-800 border-amber-200";

              return (
                <div
                  key={act.id}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs font-mono">
                        {act.tipo}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeStyle}`}>
                        {act.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                        {act.titulo}
                      </h3>
                      {act.instrucoes && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {act.instrucoes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <Layers size={14} className="text-slate-400" />
                        {numQuestoes} {numQuestoes === 1 ? "Questão" : "Questões"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <Award size={14} className="text-slate-400" />
                        Max {act.nota_maxima} pts
                      </span>
                      {act.prazo && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Clock size={14} className="text-amber-500" />
                          {new Date(act.prazo).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-2">
                    <Link
                      href={professorHref(`/professor/atividades/${act.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-800"
                    >
                      <span>{isRascunho ? "Retomar rascunho" : "Acompanhar entregas"}</span>
                      <ChevronRight size={14} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => togglePublishStatus(act.id, act.status)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        isPublicada
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {isPublicada ? "Despublicar" : "Publicar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL CONSTRUTOR DE ACTIVIDADES */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Aprendizagem Contínua</span>
                  <h2 className="text-xl font-black text-slate-900">Nova Actividade Pedagógica</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-black text-sm"
                >
                  ✕
                </button>
              </div>

              {/* FEEDBACK DE NEXT_ACTION QUANDO FALHA */}
              {nextActionError && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertCircle size={16} />
                    <span>{nextActionError.error}</span>
                  </div>
                  {nextActionError.next_action && (
                    <Link
                      href={nextActionError.next_action.href}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300"
                    >
                      <span>{nextActionError.next_action.label}</span>
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                {/* TÍTULO E TIPO */}
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Título da Actividade</label>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      placeholder="Ex: Ficha de Exercícios de Álgebra I"
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Tipo</label>
                    <select
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none"
                    >
                      <option value="quiz">Quiz Rápido</option>
                      <option value="exercicio">Exercício Prático</option>
                      <option value="tarefa">Tarefa de Casa</option>
                      <option value="simulado">Simulado Trimestral</option>
                    </select>
                  </div>
                </div>

                {/* SELEÇÃO DE TURMA E DISCIPLINA */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Turma e Disciplina</label>
                    <select
                      value={form.turma_id && form.disciplina_id ? `${form.turma_id}:${form.disciplina_id}` : ""}
                      onChange={(e) => {
                        const [tId, dId] = e.target.value.split(":");
                        setForm({ ...form, turma_id: tId || "", disciplina_id: dId || "" });
                      }}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none"
                    >
                      <option value="">Selecione a Turma e Disciplina</option>
                      {assignments.map((a) => (
                        <option key={`${a.turma_id}:${a.disciplina_id}`} value={`${a.turma_id}:${a.disciplina_id}`}>
                          {a.disciplina_nome} — {a.turma_nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-slate-400">Prazo de Entrega</label>
                      <input
                        type="date"
                        value={form.prazo}
                        onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-slate-400">Tentativas</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form.tentativas_permitidas}
                        onChange={(e) => setForm({ ...form, tentativas_permitidas: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* INSTRUÇÕES */}
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Instruções para o Aluno</label>
                  <textarea
                    rows={2}
                    value={form.instrucoes}
                    onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                    placeholder="Orientações e recomendações pedagógicas para a realização da actividade..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                {/* CONSTRUTOR DE QUESTÕES */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Questões da Actividade ({questoes.length})
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* EXTENSION POINT DE IA PEDAGÓGICA */}
                      <button
                        type="button"
                        onClick={() => toastError("IA Pedagógica", "A funcionalidade de geração automática por IA está em preparação. Crie as questões manualmente nesta etapa.")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold hover:bg-purple-100 cursor-pointer"
                        title="Gerar rascunho de questões com base nos materiais da disciplina"
                      >
                        <Bot size={14} />
                        <span>Rascunhar com IA (Em Preparação)</span>
                      </button>

                      <button
                        type="button"
                        onClick={addQuestion}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Questão</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {questoes.map((q, qIdx) => (
                      <div key={qIdx} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-emerald-800 font-mono">
                            Questão #{q.ordem}
                          </span>
                          <div className="flex items-center gap-2">
                            <select
                              value={q.tipo}
                              onChange={(e) => updateQuestion(qIdx, "tipo", e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold bg-white"
                            >
                              <option value="escolha_unica">Escolha Única</option>
                              <option value="verdadeiro_falso">Verdadeiro / Falso</option>
                              <option value="resposta_curta">Resposta Curta</option>
                            </select>
                            {questoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(qIdx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={q.enunciado}
                          onChange={(e) => updateQuestion(qIdx, "enunciado", e.target.value)}
                          placeholder={`Enunciado da questão ${qIdx + 1}...`}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none"
                        />

                        {q.tipo === "escolha_unica" && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {q.opcoes.map((opt, optIdx) => (
                              <input
                                key={optIdx}
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...q.opcoes];
                                  newOpts[optIdx] = e.target.value;
                                  updateQuestion(qIdx, "opcoes", newOpts);
                                }}
                                placeholder={`Opção ${optIdx + 1}`}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AÇÕES DE SALVAMENTO */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSubmit(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                  >
                    Guardar como Rascunho
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSubmit(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <Send size={14} />
                    <span>Publicar para a Turma</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
