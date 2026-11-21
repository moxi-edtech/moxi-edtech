"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { matchesProfessorResourceQuery } from "@/lib/professor/resource-search";
import { formatDate } from "@/lib/formatters";
import { ProfessorResourceEmptyState, ProfessorResourceErrorState, ProfessorResourceGridSkeleton } from "@/components/professor/ProfessorResourceStates";
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
  aula_id?: string | null;
  plano_aula_id?: string | null;
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
type LessonOccurrence = { id: string; data: string; inicio_previsto: string | null; fim_previsto: string | null; status: string; turma_id: string | null; disciplina_id: string | null; turma_nome: string | null; disciplina_nome: string | null };

type LessonPlan = { id: string; data: string; tema: string; turma_disciplina_id: string };

export default function ProfessorAtividadesPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const escolaParam = getEscolaParamFromPath(pathname);
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  const { success, error: toastError } = useToast();
  const [atividades, setAtividades] = useState<ActivityItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [lessonOccurrences, setLessonOccurrences] = useState<LessonOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal State for New Activity
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingActivityId, setUpdatingActivityId] = useState<string | null>(null);
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
    aula_id: string;
    plano_aula_id: string;
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
    aula_id: "",
    plano_aula_id: "",
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
      setLoadError(null);
      const [actRes, agendaRes, plansRes, lessonsRes] = await Promise.all([
        fetch("/api/professor/atividades", { cache: "no-store" }),
        fetch("/api/professor/agenda", { cache: "no-store" }),
        fetch("/api/professor/planos-aula", { cache: "no-store" }),
        fetch("/api/professor/aulas", { cache: "no-store" }),
      ]);

      const actJson = await actRes.json();
      const agendaJson = await agendaRes.json();
      const plansJson = await plansRes.json().catch(() => null);
      setLessonPlans(plansJson?.items ?? []);
      const lessonsJson = await lessonsRes.json().catch(() => null);
      setLessonOccurrences(lessonsJson?.items ?? []);

      if (!actRes.ok || !actJson?.ok) throw new Error(actJson?.error || "Não foi possível carregar as actividades.");
      setAtividades(Array.isArray(actJson.items) ? actJson.items : []);

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
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar as actividades.");
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
        aula_id: item.aula_id ?? "",
        plano_aula_id: item.plano_aula_id ?? "",
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
      if (filterStatus !== "todos" && act.status !== filterStatus) return false;
      return matchesProfessorResourceQuery(searchTerm, act.titulo, act.instrucoes, act.tipo);
    });
  }, [atividades, filterStatus, searchTerm]);

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
        aula_id: form.aula_id || null,
        plano_aula_id: form.plano_aula_id || null,
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
      toastError("Não foi possível guardar a actividade", err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  // Toggle status of existing activity
  const togglePublishStatus = async (activityId: string, currentStatus: string) => {
    setUpdatingActivityId(activityId);
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

      success(newStatus === "publicada" ? "Actividade publicada" : "Estado da actividade actualizado");
      loadData();
    } catch (err) {
      toastError("Não foi possível alterar a actividade", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingActivityId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
        
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
            className="klasse-portal-cta inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm active:scale-95 transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar actividade</span>
          </button>
        </header>

        {/* FILTROS DE ESTADO */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
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
                    ? "bg-klasse-gold text-klasse-gold-900 shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-bold text-muted-foreground px-3">
            {loading ? "A carregar..." : <>Total: <span className="font-semibold text-foreground">{filteredAtividades.length}</span></>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <label className="sr-only" htmlFor="pesquisa-atividades">Pesquisar actividades</label>
          <input
            id="pesquisa-atividades"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Pesquisar título, instruções ou tipo"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
          />
        </div>

        {/* Loading, error and empty states use one shared presentation model. */}
        {loadError ? (
          <ProfessorResourceErrorState title="Não foi possível carregar as actividades." description={loadError} onRetry={() => void loadData()} />
        ) : loading ? (
          <ProfessorResourceGridSkeleton label="A carregar actividades pedagógicas" />
        ) : filteredAtividades.length === 0 ? (
          <ProfessorResourceEmptyState
            icon={Sparkles}
            title={atividades.length === 0 ? "Ainda não existem actividades" : "Nenhuma actividade encontrada"}
            description={atividades.length === 0
              ? "Crie um quiz, exercício ou tarefa para começar."
              : "Ajuste os filtros ou limpe a pesquisa para ver outras actividades."}
            actionLabel={atividades.length === 0 ? "Criar rascunho" : "Limpar filtros"}
            onAction={atividades.length === 0
              ? () => { setNextActionError(null); setShowModal(true); }
              : () => { setSearchTerm(""); setFilterStatus("todos"); }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAtividades.map((act) => {
              const numQuestoes = act.atividade_questoes?.length ?? 0;
              const isRascunho = act.status === "rascunho";
              const isPublicada = act.status === "publicada";

              let badgeStyle = "bg-muted text-foreground border-border";
              if (isPublicada) badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
              if (isRascunho) badgeStyle = "bg-amber-50 text-amber-800 border-amber-200";

              return (
                <div
                  key={act.id}
                  className="group rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
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
                      <h3 className="font-black text-foreground text-base group-hover:text-emerald-700 transition-colors">
                        {act.titulo}
                      </h3>
                      {act.instrucoes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {act.instrucoes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground pt-1">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Layers size={14} className="text-muted-foreground" />
                        {numQuestoes} {numQuestoes === 1 ? "Questão" : "Questões"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Award size={14} className="text-muted-foreground" />
                        Max {act.nota_maxima} pts
                      </span>
                      {act.prazo && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock size={14} className="text-amber-500" />
                          {formatDate(act.prazo)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 mt-4 flex items-center justify-between gap-2">
                    <Link
                      href={professorHref(`/professor/atividades/${act.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-800"
                    >
                      <span>{isRascunho ? "Retomar rascunho" : "Acompanhar entregas"}</span>
                      <ChevronRight size={14} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => void togglePublishStatus(act.id, act.status)}
                      disabled={updatingActivityId === act.id}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        isPublicada
                          ? "bg-muted text-muted-foreground hover:bg-accent"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {updatingActivityId === act.id ? "A guardar..." : isPublicada ? "Despublicar" : "Publicar"}
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
            <div className="w-full max-w-3xl rounded-xl bg-card p-6 shadow-xl space-y-5 border border-border my-8">
              
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Aprendizagem Contínua</span>
                  <h2 className="text-xl font-black text-foreground">Nova Actividade Pedagógica</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-muted-foreground font-black text-sm"
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
                    <label className="text-xs font-black uppercase text-muted-foreground">Título da Actividade</label>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      placeholder="Ex: Ficha de Exercícios de Álgebra I"
                      className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-muted-foreground">Tipo</label>
                    <select
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                      className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none"
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
                    <label className="text-xs font-black uppercase text-muted-foreground">Turma e Disciplina</label>
                    <select
                      value={form.turma_id && form.disciplina_id ? `${form.turma_id}:${form.disciplina_id}` : ""}
                      onChange={(e) => {
                        const [tId, dId] = e.target.value.split(":");
                        setForm({ ...form, turma_id: tId || "", disciplina_id: dId || "", plano_aula_id: "", aula_id: "" });
                      }}
                      className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none"
                    >
                      <option value="">Selecione a Turma e Disciplina</option>
                      {assignments.map((a) => (
                        <option key={`${a.turma_id}:${a.disciplina_id}`} value={`${a.turma_id}:${a.disciplina_id}`}>
                          {a.disciplina_nome} — {a.turma_nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-muted-foreground">Ocorrência da aula</label>
                    <select value={form.aula_id} onChange={(e) => setForm({ ...form, aula_id: e.target.value })} className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none">
                      <option value="">Sem vínculo direto</option>
                      {lessonOccurrences.filter((lesson) => lesson.turma_id === form.turma_id && lesson.disciplina_id === form.disciplina_id).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.data} · {lesson.inicio_previsto ?? "--:--"} · {lesson.turma_nome} · {lesson.disciplina_nome}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-muted-foreground">Plano de Aula</label>
                    <select value={form.plano_aula_id} onChange={(e) => setForm({ ...form, plano_aula_id: e.target.value })} className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none">
                      <option value="">Sem vínculo ao plano</option>
                      {lessonPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.data} — {plan.tema}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-muted-foreground">Prazo de Entrega</label>
                      <input
                        type="date"
                        value={form.prazo}
                        onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                        className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-muted-foreground">Tentativas</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form.tentativas_permitidas}
                        onChange={(e) => setForm({ ...form, tentativas_permitidas: Number(e.target.value) })}
                        className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* INSTRUÇÕES */}
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground">Instruções para o Aluno</label>
                  <textarea
                    rows={2}
                    value={form.instrucoes}
                    onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                    placeholder="Orientações e recomendações pedagógicas para a realização da actividade..."
                    className="w-full rounded-xl border border-border p-2.5 text-xs font-medium text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  />
                </div>

                {/* CONSTRUTOR DE QUESTÕES */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-accent cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Questão</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {questoes.map((q, qIdx) => (
                      <div key={qIdx} className="rounded-2xl border border-border bg-muted/40/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-emerald-800 font-mono">
                            Questão #{q.ordem}
                          </span>
                          <div className="flex items-center gap-2">
                            <select
                              value={q.tipo}
                              onChange={(e) => updateQuestion(qIdx, "tipo", e.target.value)}
                              className="rounded-xl border border-border px-2 py-1 text-[11px] font-bold bg-card"
                            >
                              <option value="escolha_unica">Escolha Única</option>
                              <option value="verdadeiro_falso">Verdadeiro / Falso</option>
                              <option value="resposta_curta">Resposta Curta</option>
                            </select>
                            {questoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(qIdx)}
                                className="text-muted-foreground hover:text-rose-600 p-1"
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
                          className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-bold text-foreground outline-none"
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
                                className="rounded-xl border border-border bg-card p-2 text-xs font-medium text-foreground"
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground bg-muted hover:bg-accent"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSubmit(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-foreground border border-border hover:bg-muted/40 cursor-pointer disabled:opacity-50"
                  >
                    Guardar como Rascunho
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSubmit(true)}
                    className="klasse-portal-cta inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
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
